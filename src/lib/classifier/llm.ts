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

import { createGateway, generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import type { Klassifikation } from "@/lib/types";
import { ladeAiKey } from "@/lib/admin/ai-key";

/** Definierter Fehler bei LLM-Ausfall — kein Raten, sauberer Fallback. */
export class LlmKlassifiziererError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LlmKlassifiziererError";
  }
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
 * Ruft das LLM serverseitig auf und liefert eine validierte Klassifikation.
 * Wirft `LlmKlassifiziererError` bei jedem Fehlerfall (kein Raten).
 */
export async function klassifiziereMitLlm(
  eingabe: LlmEingabe,
  kategorien: readonly KategorieOption[],
): Promise<LlmErgebnis> {
  // Key + Modell zentral auflösen: DB-Key (PROJ-13) hat Vorrang vor ENV.
  const { key, model } = await ladeAiKey();
  if (!key) {
    throw new LlmKlassifiziererError(
      "AI_GATEWAY_API_KEY ist nicht konfiguriert.",
    );
  }
  const gateway = createGateway({ apiKey: key });

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

  const prompt =
    `Buchung:\n` +
    `Verwendungszweck: ${eingabe.verwendungszweck ?? "(leer)"}\n` +
    `Empfänger: ${eingabe.empfaenger ?? "(leer)"}\n` +
    `Betrag: ${eingabe.betrag.toFixed(2)} EUR ` +
    `(${eingabe.betrag < 0 ? "Ausgabe" : "Einnahme/Zugang"})` +
    `${stichworte}${webBlock}\n\n` +
    `Verfügbare EÜR-Kategorien:\n${baueKategorienListe(kategorien)}`;

  try {
    const { object } = await generateObject({
      model: gateway(model),
      schema: ausgabeSchema,
      system: SYSTEM_PROMPT,
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
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      throw new LlmKlassifiziererError(
        "LLM lieferte keine schemakonforme Antwort.",
        { cause: err },
      );
    }
    throw new LlmKlassifiziererError(
      err instanceof Error
        ? `LLM-Aufruf fehlgeschlagen: ${err.message}`
        : "LLM-Aufruf fehlgeschlagen.",
      { cause: err },
    );
  }
}
