// PROJ-15 — Stufe 2 der Klassifizierungs-Pipeline: Empfaenger-Kenntnis-Cache.
//
// Speichert pro normalisiertem Empfaenger Branche/Leistung/Web-Snippets und
// die letzte erfolgreiche LLM-Klassifikation. Beim ersten Vorkommen wird der
// Empfaenger einmal recherchiert; ab dem zweiten Treffer bekommt das LLM den
// Kontext direkt — kein zweiter Web-Call.
//
// DSGVO: An Firecrawl geht nur der Empfaengername — und auch nur, wenn er
// als Recherche-Kandidat gilt (Rechtsform-Indikator ODER >=3 Wortteile).
// Privatpersonen-Namen ("Max Mustermann") werden NICHT recherchiert.
//
// Race-Schutz im Massen-Lauf: Die API-Route /api/klassifizierung uebergibt
// pro Job eine InflightMap. Wenn 50 Buchungen denselben unbekannten
// Empfaenger haben, teilen sie sich einen einzigen Firecrawl-Call.
// Die Map ist BEWUSST job-scoped (kein Modul-Singleton): Tests muessen
// nichts mocken, parallele Jobs (z. B. Re-Klassifizierung waehrend eines
// Imports) blockieren sich nicht und es gibt keine Memory-Leaks ueber die
// Lebenszeit des Server-Prozesses.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Klassifikation } from "@/lib/types";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export type Kenntnisquelle = "web" | "manuell" | "llm";

export interface WebSnippet {
  titel: string;
  beschreibung: string;
  url: string;
}

export interface LetzteKlassifikation {
  klassifikation: Klassifikation;
  steuerrelevant: boolean;
  kategorie_id: string | null;
  ust_satz: 0 | 7 | 19 | null;
  konfidenz: number;
}

export interface EmpfaengerKenntnis {
  owner_id: string;
  empfaenger_norm: string;
  rohwert_beispiel: string | null;
  branche: string | null;
  leistung: string | null;
  web_snippets: WebSnippet[] | null;
  letzte_klassifikation_default: LetzteKlassifikation | null;
  quelle: Kenntnisquelle;
  recherche_versucht: boolean;
  cached_at: string;
  ttl_tage: number;
  updated_at: string;
}

export interface UpsertKenntnisEingabe {
  owner_id: string;
  empfaenger_norm: string;
  quelle: Kenntnisquelle;
  rohwert_beispiel?: string | null;
  branche?: string | null;
  leistung?: string | null;
  web_snippets?: WebSnippet[] | null;
  letzte_klassifikation_default?: LetzteKlassifikation | null;
  recherche_versucht?: boolean;
  /** Optional: TTL in Tagen. Default je quelle (manuell: ~100 Jahre). */
  ttl_tage?: number;
}

/**
 * Job-scoped Map fuer Race-Schutz im Massen-Lauf.
 * Schluessel: empfaenger_norm. Wert: laufendes Recherche-Promise.
 */
export type InflightMap = Map<string, Promise<EmpfaengerKenntnis | null>>;

export function neueInflightMap(): InflightMap {
  return new Map();
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Default-TTL bei manueller Korrektur: faktisch unbegrenzt. */
const TTL_MANUELL = 36500;

/** Rechtsform-Indikatoren, die einen Empfaenger als Firma kennzeichnen. */
const RECHTSFORM_INDIKATOREN = [
  "gmbh",
  "ug",
  "ag",
  "kg",
  "ohg",
  "gbr",
  "ek",
  "ev",
  "inc",
  "ltd",
  "llc",
  "llp",
  "bv",
  "sa",
  "sl",
  "co",
  "corp",
  "se",
  "spa",
  "srl",
  "oy",
  "ab",
];

// ---------------------------------------------------------------------------
// Pure Helper
// ---------------------------------------------------------------------------

/**
 * Prueft, ob ein Cache-Eintrag abgelaufen ist.
 * Ablaufgrenze = cached_at + ttl_tage. Das Datum SELBST (taggleich) gilt
 * noch als gueltig — abgelaufen erst ab dem Folgetag.
 */
export function istAbgelaufen(
  k: EmpfaengerKenntnis,
  jetzt: Date = new Date(),
): boolean {
  const cached = new Date(k.cached_at).getTime();
  const grenze = cached + k.ttl_tage * 24 * 60 * 60 * 1000;
  return jetzt.getTime() > grenze;
}

/**
 * Recherche-Kandidat? DSGVO-Gate: Nur Empfaenger mit Rechtsform-Indikator
 * (GmbH, Ltd, Inc, ...) ODER mindestens 3 Wortteilen werden recherchiert.
 * Privatpersonen wie "Max Mustermann" (2 Wortteile, keine Rechtsform) sind
 * ausgeschlossen.
 *
 * PROJ-16: zusaetzlich werden Familienmitglieder aus "Mein Profil" hart
 * ausgeschlossen — egal wieviele Wortteile ihr Name hat. So landet ein
 * Familienmitglied mit Mittel- oder Doppelnamen ("Anna Maria Schmidt") nie
 * im Web-Lookup.
 *
 * @param roh             Rohwert vor Normalisierung (fuer Rechtsform-Check
 *                         inkl. moeglicher Sonderzeichen wie "GmbH & Co. KG").
 * @param normalisiert    Bereits normalisierter Empfaenger (lowercase, ohne
 *                         Rechtsform — fuer Wortteil-Zaehlung).
 * @param familie         Optionale Liste der Familienmitglieder mit ihrem
 *                         `name_normalisiert`. Wenn der normalisierte
 *                         Empfaenger exakt matcht → false (kein Web-Lookup).
 */
export function istRechercheKandidat(
  roh: string | null | undefined,
  normalisiert: string | null | undefined,
  familie?: ReadonlyArray<{ name_normalisiert: string }>,
): boolean {
  const norm = (normalisiert ?? "").trim();
  if (norm.length === 0) return false;

  // PROJ-16: Familienmitglieder-Negativliste (DSGVO — keine PII zu Firecrawl).
  if (familie && familie.length > 0) {
    const normLower = norm.toLowerCase();
    for (const f of familie) {
      if (f.name_normalisiert.trim().toLowerCase() === normLower) {
        return false;
      }
    }
  }

  // Rechtsform-Indikator im Rohwert (case-insensitive, an Wortgrenzen).
  const rohLower = (roh ?? "").toLowerCase();
  for (const ind of RECHTSFORM_INDIKATOREN) {
    // \b ist ASCII; vor/nach Wort: Whitespace, Satzzeichen, Punkt, Klammer.
    const re = new RegExp(
      `(^|[\\s,.()\\-/])${ind}\\.?($|[\\s,.()\\-/])`,
      "i",
    );
    if (re.test(rohLower)) return true;
  }

  // Wortteile im normalisierten Wert zaehlen.
  const teile = norm.split(/\s+/).filter((t) => t.length > 0);
  return teile.length >= 3;
}

/**
 * Liefert die Default-TTL fuer eine Quelle (in Tagen).
 *  - manuell: 100 Jahre (faktisch unbegrenzt, bis Nutzer aendert)
 *  - web:     180 Tage  (Branche/Leistung sind stabil)
 *  - llm:      30 Tage  (kuerzer, weil LLM auch danebenliegen kann)
 */
export function defaultTtl(quelle: Kenntnisquelle): number {
  if (quelle === "manuell") return TTL_MANUELL;
  if (quelle === "llm") return 30;
  return 180;
}

// ---------------------------------------------------------------------------
// DB-Zugriff
// ---------------------------------------------------------------------------

const SELECT_KENNTNIS =
  "owner_id, empfaenger_norm, rohwert_beispiel, branche, leistung, " +
  "web_snippets, letzte_klassifikation_default, quelle, recherche_versucht, " +
  "cached_at, ttl_tage, updated_at";

/**
 * Liest einen Cache-Eintrag. Liefert null, wenn nicht vorhanden.
 * Owner-Filter zusaetzlich zur RLS (Defense-in-Depth).
 */
export async function holeKenntnis(
  supabase: SupabaseClient,
  owner_id: string,
  empfaenger_norm: string,
): Promise<EmpfaengerKenntnis | null> {
  const norm = empfaenger_norm.trim();
  if (norm.length === 0) return null;

  const { data, error } = await supabase
    .from("empfaenger_kenntnis")
    .select(SELECT_KENNTNIS)
    .eq("owner_id", owner_id)
    .eq("empfaenger_norm", norm)
    .maybeSingle();

  if (error || !data) return null;
  // Supabase JS-Client kann den Select-String nicht statisch in die
  // Zieltyp-Form aufloesen; `unknown`-Brücke ist hier erforderlich.
  return data as unknown as EmpfaengerKenntnis;
}

/**
 * Upsert eines Cache-Eintrags. Schreibt NUR, wenn empfaenger_norm nicht
 * leer ist. Setzt cached_at auf jetzt und ttl_tage je nach Quelle (falls
 * nicht explizit angegeben). updated_at uebernimmt der DB-Trigger.
 *
 * Best-effort-Audit: ein zusaetzlicher Insert in audit_eintrag mit aktion
 * 'kenntnis_aktualisiert'. Schlaegt der Audit-Insert fehl, wird nicht
 * geworfen — der Cache-Upsert ist die fachlich wichtige Operation.
 */
export async function upsertKenntnis(
  supabase: SupabaseClient,
  eingabe: UpsertKenntnisEingabe,
): Promise<void> {
  const norm = eingabe.empfaenger_norm.trim();
  if (norm.length === 0) return;

  const ttl = eingabe.ttl_tage ?? defaultTtl(eingabe.quelle);
  const jetzt = new Date().toISOString();

  const row = {
    owner_id: eingabe.owner_id,
    empfaenger_norm: norm,
    rohwert_beispiel: eingabe.rohwert_beispiel ?? null,
    branche: eingabe.branche ?? null,
    leistung: eingabe.leistung ?? null,
    web_snippets: eingabe.web_snippets ?? null,
    letzte_klassifikation_default:
      eingabe.letzte_klassifikation_default ?? null,
    quelle: eingabe.quelle,
    recherche_versucht: eingabe.recherche_versucht ?? false,
    cached_at: jetzt,
    ttl_tage: ttl,
  };

  const { error } = await supabase
    .from("empfaenger_kenntnis")
    .upsert(row, { onConflict: "owner_id,empfaenger_norm" });

  if (error) {
    // Stiller Fail-Modus: Cache ist Optimierung, kein Pflicht-Pfad.
    // Aufrufer (Pipeline) hat ohnehin schon ein gueltiges Ergebnis.
    return;
  }

  // Best-effort Audit-Schreiben — Supabase JS-Client unterstuetzt keine
  // expliziten Transaktionen, daher sequentiell als zweiter Insert.
  await supabase
    .from("audit_eintrag")
    .insert({
      owner_id: eingabe.owner_id,
      entitaet: "empfaenger_kenntnis",
      entitaet_id: null,
      aktion: "kenntnis_aktualisiert",
      quelle: eingabe.quelle,
      details: {
        empfaenger_norm: norm,
        quelle: eingabe.quelle,
        branche: eingabe.branche ?? null,
        leistung: eingabe.leistung ?? null,
        recherche_versucht: eingabe.recherche_versucht ?? false,
      },
    })
    // best-effort: Fehler hier nicht propagieren.
    .then(() => undefined, () => undefined);
}

/**
 * PROJ-15-Bugfix: Aktualisiert AUSSCHLIESSLICH
 * `letzte_klassifikation_default`, ohne `quelle`, `branche`, `leistung` oder
 * `web_snippets` anzufassen. Verhindert, dass ein erfolgreicher LLM-Lauf
 * einen bestehenden `quelle='web'`-Eintrag (inkl. Branche/Leistung/Snippets)
 * auf `quelle='llm'` umstellt und damit das Web-Wissen verliert.
 *
 * Geht still durch, wenn kein Datensatz existiert (kein Insert!). Die
 * Erstanlage erfolgt ueber `upsertKenntnis`.
 */
export async function aktualisiereLetzteKlassifikation(
  supabase: SupabaseClient,
  owner_id: string,
  empfaenger_norm: string,
  letzte_klassifikation_default: LetzteKlassifikation,
): Promise<void> {
  const norm = empfaenger_norm.trim();
  if (norm.length === 0) return;

  await supabase
    .from("empfaenger_kenntnis")
    .update({ letzte_klassifikation_default })
    .eq("owner_id", owner_id)
    .eq("empfaenger_norm", norm);
  // Best-effort: ein Fehler hier (z. B. fehlende RLS-Berechtigung) darf den
  // Klassifikations-Pfad nicht abbrechen. Der Cache ist Optimierung,
  // kein Pflicht-Pfad — analog zu `upsertKenntnis`.
}
