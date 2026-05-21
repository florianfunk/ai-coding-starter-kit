// PROJ-5 — Stufe 2 der Pipeline: LLM-Klassifizierer (NUR serverseitig).
//
// DSGVO / Datensparsamkeit (siehe docs/ARCHITECTURE.md Abschnitt 3):
// An das LLM gehen AUSSCHLIESSLICH Verwendungszweck, Betrag, Empfänger und
// optional Beleg-Stichworte. KEINE Steuernummer, USt-IdNr., Kontodaten oder
// vollständigen Belegtexte. Modell + Gateway-Key werden zentral über
// ladeAiKey() aufgelöst (DB-Key hat Vorrang vor ENV — PROJ-13).
//
// Robustheit: Bei LLM-Ausfall/ungültiger Antwort wird ein definierter
// LlmKlassifiziererError geworfen — es wird NICHT geraten. Die Pipeline
// fängt diesen Fehler ab und schickt die Buchung in die Prüfliste.

import {
  APICallError,
  createGateway,
  generateObject,
  NoObjectGeneratedError,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { z } from "zod";
import type { Klassifikation } from "@/lib/types";
import { ladeAiKey } from "@/lib/admin/ai-key";
import type { EmpfaengerKenntnis } from "@/lib/classifier/empfaenger-cache";
import type { HistorieSummary } from "@/lib/classifier/historie";
import {
  formatiereProfilFuerLlm,
  type MeinProfil,
} from "@/lib/classifier/profil";

/** Definierter Fehler bei LLM-Ausfall — kein Raten, sauberer Fallback. */
export class LlmKlassifiziererError extends Error {
  /**
   * Anzahl der zusaetzlich zum initialen Versuch durchgefuehrten Retries
   * (0 = nur der initiale Versuch, 1 = ein Retry). Wird vom Aufrufer im
   * Audit-Eintrag als `details.llm_retries` vermerkt, damit wir nachvollziehen
   * koennen, wie oft die stochastischen NoObjectGeneratedError-Aussetzer
   * tatsaechlich geretried werden mussten.
   */
  public readonly retries: number;

  constructor(
    message: string,
    options?: { cause?: unknown; retries?: number },
  ) {
    super(message, options);
    this.name = "LlmKlassifiziererError";
    this.retries = options?.retries ?? 0;
  }
}

/**
 * Wieviele zusaetzliche Versuche maximal gemacht werden, wenn `generateObject`
 * mit einem retry-faehigen Fehler scheitert. 1 Retry zusaetzlich zum initialen
 * Versuch bedeutet: insgesamt bis zu 2 LLM-Calls pro Buchung.
 */
const MAX_RETRIES = 1;

/** Basis-Wartezeit zwischen den Versuchen (ms) — Jitter wird addiert. */
const RETRY_BASE_DELAY_MS = 800;
const RETRY_JITTER_MS = 200;

/**
 * Test-Override: Wenn gesetzt, ueberschreibt die Wartezeit zwischen Retries.
 * Wird ausschliesslich in `llm.test.ts` benutzt, um die 800ms-Sleeps fuer
 * die Test-Suite auf 0 zu druecken. Nicht oeffentlich exportiert (intern).
 */
let retryDelayOverrideMs: number | null = null;
export function _setRetryDelayForTest(ms: number | null): void {
  retryDelayOverrideMs = ms;
}

/**
 * Entscheidet, ob ein Fehler von `generateObject` retry-faehig ist:
 *  - `NoObjectGeneratedError` (Schema-Mismatch / halluzinierte Felder) ist
 *    klassisch stochastisch und beim zweiten Versuch oft sofort erfolgreich.
 *  - `APICallError` mit Status 5xx oder ohne Statuscode (Netzwerk-/Timeout-
 *    Fehler) — Provider hat selbst signalisiert „transient".
 *  - Alle 4xx (z. B. 401/403/404/422 — fehlender Key, ungueltige Eingabe,
 *    Modellname falsch) sind permanent und werden NICHT geretried.
 *
 * Reine Funktion — testbar ohne IO.
 */
export function istRetryFaehig(fehler: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(fehler)) return true;
  if (APICallError.isInstance(fehler)) {
    // Provider sagt explizit: nicht retryen → respektieren.
    if (fehler.isRetryable === false) {
      // 5xx aber explizit als nicht-retryable markiert → durchreichen.
      // (In der Praxis selten, aber SDK darf das setzen.)
      return false;
    }
    const status = fehler.statusCode;
    if (typeof status !== "number") {
      // Netzwerk-/Timeout-Fehler ohne Statuscode → retryen.
      return true;
    }
    return status >= 500 && status < 600;
  }
  return false;
}

/** Hilfsfunktion fuer Retry-Delay mit symmetrischem Jitter (+/- 200ms). */
function ermittleDelayMs(): number {
  if (retryDelayOverrideMs !== null) return retryDelayOverrideMs;
  const jitter = Math.floor((Math.random() * 2 - 1) * RETRY_JITTER_MS);
  return Math.max(0, RETRY_BASE_DELAY_MS + jitter);
}

async function warte(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Minimaler, datensparsamer Input an das LLM. */
export interface LlmEingabe {
  verwendungszweck: string | null;
  betrag: number;
  empfaenger: string | null;
  /** Optionale Beleg-Stichworte (z. B. Titel/Tags), KEIN OCR-Volltext. */
  beleg_stichworte?: string[];
  /**
   * Optionaler Web-Recherche-Kontext (Klartext-Block, vorformatiert).
   * Wird nur bei Retry nach Unsicherheit gefüllt. Datensparsam:
   * Suchanfrage enthält NUR den Empfängernamen, keine Buchungsdetails.
   */
  web_kontext?: string;
  /**
   * Optionaler Empfaenger-Kenntnis-Cache (Branche, Leistung, Snippets).
   * Wird vom Pipeline-Wiring aus empfaenger-cache.ts gefuettert.
   */
  empfaenger_kenntnis?: EmpfaengerKenntnis | null;
  /**
   * Optionale Buchungs-Historie fuer denselben normalisierten Empfaenger.
   * Wird nur eingeblendet, wenn anzahl >= 2 (sonst keine Aussagekraft).
   */
  historie?: HistorieSummary | null;
  /**
   * PROJ-16: Persoenliche Stammdaten ("Mein Profil") als zusaetzlicher
   * Kontext-Block. Wird vor Empfaenger-Hintergrund und Historie eingespielt,
   * weil Profil-Treffer (Arbeitgeber/Familie/eigene Konten) die staerksten
   * Signale fuer die korrekte Klassifikation sind.
   */
  mein_profil?: MeinProfil | null;
  /**
   * PROJ-16: Vorab vom Pipeline-Wiring berechnete Hinweise, die die
   * Profil-Logik schon ausgewertet hat (Arbeitgeber-Match mit Lohn/Gehalt-
   * Zweck, Familienmitglied, eigenes Konto). Optional — das LLM bekommt
   * den Hinweis als kurzen Klartext-Block, damit es das Profil-Signal
   * nicht erst selbst rekonstruieren muss.
   */
  profil_hinweis?: string | null;
}

/** Eine wählbare Zielkategorie (nur ID + Bezeichnung + Typ ans LLM). */
export interface KategorieOption {
  id: string;
  bezeichnung: string;
  typ: "einnahme" | "ausgabe" | "privat" | "neutral";
}

export interface LlmErgebnis {
  klassifikation: Klassifikation;
  steuerrelevant: boolean;
  /** Vorgeschlagene Kategorie-ID aus der übergebenen Liste oder null. */
  kategorie_id: string | null;
  ust_satz: number | null;
  begruendung: string;
  /** Konfidenz 0..1. */
  konfidenz: number;
  /**
   * Anzahl der zusaetzlich zum initialen Versuch durchgefuehrten Retries
   * (0 = initialer Versuch hat geklappt). Optional, weil reine Helper-
   * Funktionen + Tests, die `LlmErgebnis` von Hand bauen, das Feld nicht
   * setzen muessen. Im Audit-Pfad wird `retries ?? 0` verwendet.
   */
  retries?: number;
}

/** Strukturiertes Ausgabe-Schema (erzwingt valide LLM-Antwort). */
const ausgabeSchema = z.object({
  klassifikation: z.enum(["privat", "geschaeftlich", "unklar", "neutral"]),
  steuerrelevant: z.boolean(),
  kategorie_id: z
    .string()
    .nullable()
    .describe("ID aus der Kategorienliste oder null, wenn keine passt"),
  ust_satz: z
    .union([z.literal(0), z.literal(7), z.literal(19)])
    .nullable()
    .describe("USt-Satz in Prozent oder null"),
  begruendung: z
    .string()
    .min(1)
    .max(600)
    .describe("Kurze, nachvollziehbare Begründung auf Deutsch"),
  konfidenz: z
    .number()
    .min(0)
    .max(1)
    .describe("Selbsteinschätzung der Sicherheit von 0 bis 1"),
});

function baueKategorienListe(kategorien: readonly KategorieOption[]): string {
  if (kategorien.length === 0) return "(keine Kategorien vorhanden)";
  return kategorien
    .map((k) => `- id=${k.id} | ${k.bezeichnung} (${k.typ})`)
    .join("\n");
}

/**
 * Baut den optionalen Empfaenger-Kenntnis-Block fuer den User-Prompt.
 * Bei `null/undefined` Eingabe → leerer String (Block wird ueberhaupt nicht
 * ausgegeben). Reine Funktion.
 */
function baueKenntnisBlock(
  kenntnis: EmpfaengerKenntnis | null | undefined,
): string {
  if (!kenntnis) return "";
  const branche = kenntnis.branche?.trim() || "unbekannt";
  const leistung = kenntnis.leistung?.trim() || "unbekannt";
  const snippets = (kenntnis.web_snippets ?? [])
    .map((s) => s.titel)
    .filter((t) => t.trim().length > 0)
    .slice(0, 3)
    .join("; ");
  const quellen = snippets.length > 0 ? snippets : "(keine)";
  return (
    `\n\nEmpfaenger-Hintergrund:\n` +
    `- Branche: ${branche}\n` +
    `- Leistung: ${leistung}\n` +
    `- Web-Quellen: ${quellen}`
  );
}

/**
 * Baut den optionalen Historie-Block. Nur ab anzahl >= 2 sinnvoll
 * (1 Treffer = aktuelle Buchung ist erstmal noch ein Einzelfall).
 * Reine Funktion.
 */
function baueHistorieBlock(
  historie: HistorieSummary | null | undefined,
  kategorien: readonly KategorieOption[],
): string {
  if (!historie || historie.anzahl < 2) return "";

  const minStr = historie.betrag_min.toFixed(2);
  const maxStr = historie.betrag_max.toFixed(2);
  const medStr = historie.betrag_median.toFixed(2);

  const katBez =
    historie.haeufigste_kategorie_id
      ? kategorien.find((k) => k.id === historie.haeufigste_kategorie_id)
          ?.bezeichnung ?? "(unbekannte Kategorie)"
      : "(keine Kategorie)";

  const klass = historie.haeufigste_klassifikation ?? "unklar";

  return (
    `\n\nHistorie fuer diesen Empfaenger:\n` +
    `- Bisher ${historie.anzahl}x verbucht, Betrag zwischen ${minStr} EUR und ${maxStr} EUR (Median ${medStr} EUR)\n` +
    `- Meistens als "${katBez}" (${historie.haeufigste_kategorie_anzahl}x), Klassifikation ${klass}\n` +
    `- Hinweis: Wenn der aktuelle Betrag und Empfaenger gut passen, hohe Konfidenz vergeben.`
  );
}

const SYSTEM_PROMPT = [
  "Du bist ein deutscher Buchhaltungs-Assistent für ein Einzelunternehmen (EÜR).",
  "Aufgabe: Ordne eine einzelne Kontobuchung anhand von Empfänger und",
  "Verwendungszweck (und optional Beleg-Stichworten) ein.",
  "",
  "ARBEITSWEISE:",
  "1) Analysiere zuerst den EMPFÄNGER (Name/Firma). Der Empfänger ist das",
  "   stärkste Signal — viele Firmen sind eindeutig privat (REWE, Edeka,",
  "   Apotheke, Krankenkasse, Stromanbieter, Telekom Mobilfunk) oder",
  "   eindeutig geschäftlich (Cloud-/SaaS-Dienste wie Strato, AWS,",
  "   Amazon Business, Adobe; Steuerberater; Werbeplattformen).",
  "2) Prüfe dann den VERWENDUNGSZWECK auf weitere Hinweise (Rechnungsnr.,",
  "   Lastschrift-Mandat, 'Mobilfunk', 'Miete', 'Gehalt', 'Geburtstag' etc.).",
  "3) Wähle aus der Kategorienliste die spezifischste passende — bevorzugt",
  "   eine PRIVAT-Kategorie für private Ausgaben (z. B. 'Privat: Lebensmittel'",
  "   statt nur 'Privatentnahme'), und eine konkrete Geschäfts-Kategorie",
  "   (z. B. 'Software / IT / Cloud-Dienste' für Strato/AWS/Adobe,",
  "   'Bewirtung / Spesen' für Restaurants im geschäftlichen Kontext).",
  "",
  "ENTSCHEIDUNGSGRUNDSÄTZE:",
  "- klassifikation: 'privat' (Lebenshaltung, Familie, Privat-KFZ, Hobby,",
  "   private Versicherungen), 'geschaeftlich' (Betriebsausgaben, Umsätze),",
  "   'neutral' (Geldtransit zwischen eigenen Konten, USt-Zahllast/-Erstattung,",
  "   PayPal-Übertrag aufs eigene Konto), 'unklar' (gemischt privat/geschäftlich",
  "   wie Tankstelle ohne Kontext, oder unbekannter Empfänger).",
  "- steuerrelevant: true nur, wenn die Buchung in die EÜR/USt einfließt.",
  "   Private Ausgaben sind nicht steuerrelevant (ggf. Sonderausgaben/außerg.",
  "   Belastungen, aber das gehört in die ESt-Anlage, nicht in die EÜR).",
  "- ust_satz: 0, 7 oder 19 für Geschäftsausgaben (Standard 19% bei Sach-/",
  "   Dienstleistungen, 7% bei Büchern/Lebensmitteln/Personenbeförderung,",
  "   0% bei Versicherungen/Bankgebühren/Mieten ohne USt-Option). null bei",
  "   privat/neutral.",
  "- Bei eindeutig privat (z. B. 'Geburtstag', 'Miete privat', 'REWE'):",
  "   hohe Konfidenz (≥0.9) ist erlaubt.",
  "- Bei gemischt nutzbaren Ausgaben (Tankstelle, Restaurant, Telefon,",
  "   Amazon ohne 'Business') ohne klaren Kontext: 'unklar', Konfidenz ≤0.5.",
  "- NICHT raten bei vollständig unbekannten Empfängern — lieber 'unklar'.",
  "- ID-Pflicht: kategorie_id MUSS exakt einer id aus der Liste entsprechen,",
  "   sonst null setzen.",
  "",
  "Antworte ausschließlich über das vorgegebene JSON-Schema.",
].join("\n");

/**
 * Wählt den richtigen LLM-Provider anhand des Key-Formats:
 * - `sk-ant-…` → direkter Anthropic-Provider (`@ai-sdk/anthropic`)
 * - sonst (`vck_…` u. a.) → Vercel AI Gateway
 *
 * Der Modell-Slug wird beim direkten Anthropic-Pfad normalisiert:
 * `anthropic/claude-haiku-4.5` → `claude-haiku-4-5` (Anthropic API
 * erwartet Bindestrich-Format ohne Provider-Präfix).
 */
function wahleProvider(
  key: string,
  modell: string,
): { model: LanguageModel; provider: "anthropic" | "gateway" } {
  if (key.startsWith("sk-ant-")) {
    const anthropic = createAnthropic({ apiKey: key });
    // "anthropic/claude-haiku-4.5" → "claude-haiku-4-5"
    const normalisiert = modell
      .replace(/^anthropic\//, "")
      .replace(/\./g, "-");
    return { model: anthropic(normalisiert), provider: "anthropic" };
  }
  const gateway = createGateway({ apiKey: key });
  return { model: gateway(modell), provider: "gateway" };
}

/**
 * Ein einzelner LLM-Aufruf — wirft den Roh-Fehler durch, damit die Retry-
 * Schicht entscheiden kann. Reines Wrap um `generateObject` + Schema-
 * Postprocessing (Kategorie-Whitelist).
 *
 * Beim Retry (`versuchsNummer > 0`) wird dem System-Prompt eine zusaetzliche
 * Schema-Mahnung vorangestellt. Subtile Variation — der LLM-Stochastik reicht
 * meistens schon, aber die Mahnung schadet nichts und macht den Retry beim
 * Lesen des Audit-Eintrags nachvollziehbar.
 */
async function einVersuch(
  llmModel: LanguageModel,
  prompt: string,
  kategorien: readonly KategorieOption[],
  versuchsNummer: number,
): Promise<Omit<LlmErgebnis, "retries">> {
  const system =
    versuchsNummer === 0
      ? SYSTEM_PROMPT
      : `Antworte STRENG nach dem JSON-Schema. Jedes Feld muss genau dem im Schema vorgegebenen Typ entsprechen.\n\n${SYSTEM_PROMPT}`;

  const { object } = await generateObject({
    model: llmModel,
    schema: ausgabeSchema,
    system,
    prompt,
  });

  // Halluzinierte Kategorie-IDs verwerfen (nur erlaubte zulassen).
  const erlaubt = new Set(kategorien.map((k) => k.id));
  const kategorieId =
    object.kategorie_id && erlaubt.has(object.kategorie_id)
      ? object.kategorie_id
      : null;

  return {
    klassifikation: object.klassifikation,
    steuerrelevant: object.steuerrelevant,
    kategorie_id: kategorieId,
    ust_satz: object.ust_satz,
    begruendung: object.begruendung,
    konfidenz: object.konfidenz,
  };
}

/**
 * Ruft das LLM serverseitig auf und liefert eine validierte Klassifikation.
 * Wirft `LlmKlassifiziererError` bei jedem Fehlerfall (kein Raten).
 *
 * Retry-Strategie (PROJ-15 Konsistenz/Pro):
 *  - Maximal `MAX_RETRIES` zusaetzliche Versuche (1 Retry → insgesamt 2 Calls).
 *  - Retry NUR bei `NoObjectGeneratedError` (Schema-Mismatch, oft stochastisch)
 *    und `APICallError` mit Status 5xx oder fehlendem Statuscode (Timeout).
 *  - 4xx (Auth/Eingabe/Modell-Slug) wird NICHT geretried — das ist permanent.
 *  - Zwischen den Versuchen warten wir `RETRY_BASE_DELAY_MS` +/- Jitter, damit
 *    parallele Buchungen mit demselben Aussetzer nicht synchron laufen.
 *  - Beim Retry-Versuch wird das System-Prompt um eine zusaetzliche Mahnung
 *    ergaenzt ("Antworte STRENG nach Schema."). Identische LLM-Settings,
 *    identische User-Prompt — die Variation ist subtil und zielt nur darauf,
 *    dem Modell den Schema-Zwang noch einmal explizit zu nennen.
 *  - Wenn beide Versuche scheitern, wirft die Funktion `LlmKlassifiziererError`
 *    mit `retries` = Anzahl der getaetigten Retries, damit der Aufrufer das
 *    im Audit-Eintrag dokumentieren kann.
 */
export async function klassifiziereMitLlm(
  eingabe: LlmEingabe,
  kategorien: readonly KategorieOption[],
): Promise<LlmErgebnis> {
  // Key + Modell zentral auflösen: DB-Key (PROJ-13) hat Vorrang vor ENV.
  const { key, model } = await ladeAiKey();
  if (!key) {
    throw new LlmKlassifiziererError(
      "Kein LLM-Key konfiguriert (weder DB noch ENV).",
    );
  }
  const { model: llmModel } = wahleProvider(key, model);

  const stichworte =
    eingabe.beleg_stichworte && eingabe.beleg_stichworte.length > 0
      ? `\nBeleg-Stichworte: ${eingabe.beleg_stichworte
          .slice(0, 12)
          .join(", ")}`
      : "";

  const webBlock =
    eingabe.web_kontext && eingabe.web_kontext.trim().length > 0
      ? `\n\n${eingabe.web_kontext.trim()}`
      : "";

  const kenntnisBlock = baueKenntnisBlock(eingabe.empfaenger_kenntnis);
  const historieBlock = baueHistorieBlock(eingabe.historie, kategorien);
  // PROJ-16: Persoenliche Stammdaten — Block kommt VOR Kenntnis/Historie,
  // weil Profil-Treffer (Arbeitgeber/Familie/eigene Konten) die staerksten
  // Signale sind.
  const profilText = formatiereProfilFuerLlm(eingabe.mein_profil);
  const profilBlock = profilText.length > 0 ? `\n\n${profilText}` : "";
  const profilHinweisBlock =
    eingabe.profil_hinweis && eingabe.profil_hinweis.trim().length > 0
      ? `\n\nProfil-Hinweis für genau diese Buchung: ${eingabe.profil_hinweis.trim()}`
      : "";

  const prompt =
    `Buchung:\n` +
    `Verwendungszweck: ${eingabe.verwendungszweck ?? "(leer)"}\n` +
    `Empfänger: ${eingabe.empfaenger ?? "(leer)"}\n` +
    `Betrag: ${eingabe.betrag.toFixed(2)} EUR ` +
    `(${eingabe.betrag < 0 ? "Ausgabe" : "Einnahme/Zugang"})` +
    `${stichworte}${profilBlock}${profilHinweisBlock}${kenntnisBlock}${historieBlock}${webBlock}\n\n` +
    `Verfügbare EÜR-Kategorien:\n${baueKategorienListe(kategorien)}`;

  let letzterFehler: unknown = null;
  let retries = 0;

  // Insgesamt MAX_RETRIES + 1 Versuche.
  for (let versuch = 0; versuch <= MAX_RETRIES; versuch++) {
    try {
      const ergebnis = await einVersuch(llmModel, prompt, kategorien, versuch);
      return { ...ergebnis, retries: versuch };
    } catch (err) {
      letzterFehler = err;
      const kannRetryen =
        versuch < MAX_RETRIES && istRetryFaehig(err);
      if (!kannRetryen) break;
      retries++;
      await warte(ermittleDelayMs());
    }
  }

  // Beide Versuche fehlgeschlagen — sauber als LlmKlassifiziererError werfen.
  if (NoObjectGeneratedError.isInstance(letzterFehler)) {
    throw new LlmKlassifiziererError(
      "LLM lieferte keine schemakonforme Antwort.",
      { cause: letzterFehler, retries },
    );
  }
  throw new LlmKlassifiziererError(
    letzterFehler instanceof Error
      ? `LLM-Aufruf fehlgeschlagen: ${letzterFehler.message}`
      : "LLM-Aufruf fehlgeschlagen.",
    { cause: letzterFehler, retries },
  );
}
