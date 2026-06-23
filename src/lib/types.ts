// Gemeinsame Domänentypen (Klartext-Spiegel des DB-Schemas).

export type Rechtsform = "einzelunternehmer" | "freiberufler";
export type UstStatus = "regelbesteuerung" | "kleinunternehmer";
export type UstRhythmus = "monatlich" | "quartalsweise" | "jaehrlich";

export interface Firmenprofil {
  id: string;
  firmenname: string;
  inhaber: string;
  steuernummer: string | null;
  ust_idnr: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  finanzamt: string | null;
  rechtsform: Rechtsform;
  ust_status: UstStatus;
  wirtschaftsjahr_beginn: number;
  ust_va_rhythmus: UstRhythmus;
  rhythmus_gueltig_ab: string | null;
  /** PROJ-27: Dauerfristverlängerung — verschiebt USt-VA-Frist um 1 Monat. */
  dauerfristverlaengerung: boolean;
}

export type KategorieTyp = "einnahme" | "ausgabe" | "privat" | "neutral";

export interface Kategorie {
  id: string;
  bezeichnung: string;
  typ: KategorieTyp;
  ust_satz: number | null;
  euer_zeile: string | null;
  elster_kennzahl: string | null;
  aktiv: boolean;
  gueltig_ab: string | null;
}

export type KontoTyp = "bank" | "paypal" | "kreditkarte";

export interface Konto {
  id: string;
  bezeichnung: string;
  typ: KontoTyp;
  mapping: KontoMapping | null;
}

export type DatumFormat = "auto" | "DE" | "US" | "ISO";

export interface KontoMapping {
  datum: string;
  betrag: string;
  verwendungszweck?: string;
  empfaenger?: string;
  waehrung?: string;
  betrag_vorzeichen_invertieren?: boolean;
  /**
   * Reihenfolge in Datumsstrings mit Trennzeichen "." "/" "-".
   * - "auto" (Default): DE (TT.MM.JJJJ) wird bevorzugt; bei eindeutigem
   *   US-Layout (erster Teil ≤12, zweiter Teil >12) wird US erkannt.
   * - "DE": TT.MM.JJJJ erzwingen (Bank-/Sparkassen-Exporte).
   * - "US": M/D/YY erzwingen (z. B. MoneyMoney-Export).
   * - "ISO": JJJJ-MM-TT erzwingen.
   */
  datum_format?: DatumFormat;
}

export type BuchungStatus =
  | "offen"
  | "auto_verbucht"
  | "zur_pruefung"
  | "manuell_bestaetigt";

export type Klassifikation = "privat" | "geschaeftlich" | "unklar" | "neutral";

export interface Buchung {
  id: string;
  konto_id: string;
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
  waehrung: string;
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  kategorie_id: string | null;
  ust_satz: number | null;
  begruendung: string | null;
  konfidenz: number | null;
  quelle: "regel" | "ki" | "manuell" | null;
  status: BuchungStatus;
  pruef_grund: string | null;
  parent_buchung_id: string | null;
  split_anteil: number | null;
  // PROJ-20: Merkliste — Zeitpunkt, zu dem die Buchung gemerkt wurde
  // (null = nicht gemerkt). Wird nur in den Stern-Oberflächen mitgeladen.
  gemerkt_am: string | null;
}

export interface Beleg {
  id: string;
  paperless_id: number;
  titel: string | null;
  beleg_datum: string | null;
  korrespondent: string | null;
  betrag: number | null;
  tags: string[] | null;
  ocr_text: string | null;
  quell_link: string | null;
  status: "importiert" | "unvollstaendig" | "quelle_entfernt";
}

/**
 * PROJ-15 P1 — Split-Aktion einer Lernregel. Teilt eine Buchung automatisch in
 * zwei Kind-Buchungen (geschäftlicher + privater Anteil), analog zur manuellen
 * Aufteilung in der Prüfliste. Anteile sind in 0..1 und summieren sich zu 1.
 * Schließt einfache `kategorie_id`/`klassifikation` in der Aktion aus.
 */
export interface LernregelSplit {
  /** Geschäftlicher Anteil in 0..1 (z. B. 0.7 für 70 %). */
  anteil_geschaeftlich: number;
  /** Privater Anteil in 0..1; `anteil_geschaeftlich + anteil_privat === 1`. */
  anteil_privat: number;
  /** Kategorie des geschäftlichen Teils (optional). */
  kategorie_geschaeftlich?: string | null;
  /** Kategorie des privaten Teils (optional). */
  kategorie_privat?: string | null;
  /** USt-Satz des geschäftlichen Teils (privater Teil bekommt 0 % bzw. Default). */
  ust_satz_geschaeftlich?: number | null;
}

export interface Lernregel {
  id: string;
  bezeichnung: string;
  bedingung: {
    empfaenger_muster?: string;
    zweck_muster?: string;
    /**
     * PROJ-15 P1 — case-insensitiver Regex gegen `empfaenger_normalisiert`
     * (Fallback: rohes `empfaenger`). Wird über `regex-engine.ts` statisch
     * auf ReDoS geprüft; ein nicht-kompilierbares/unsicheres Muster matcht NIE.
     */
    empfaenger_regex?: string;
    /** PROJ-15 P1 — case-insensitiver Regex gegen `verwendungszweck`. */
    zweck_regex?: string;
    konto_id?: string;
    betrag_min?: number;
    betrag_max?: number;
  };
  aktion: {
    kategorie_id?: string;
    ust_satz?: number;
    klassifikation?: Klassifikation;
    /** PROJ-15 P1 — Split-Aktion (schließt kategorie_id/klassifikation aus). */
    split?: LernregelSplit;
  };
  prioritaet: number;
  aktiv: boolean;
  treffer_zaehler: number;
}

export type JobArt =
  | "paperless_sync"
  | "konto_import"
  | "klassifizierung"
  | "matching";

export interface JobLauf {
  id: string;
  art: JobArt;
  status: "laeuft" | "fertig" | "fehler";
  fortschritt: number;
  gesamt: number | null;
  ergebnis: Record<string, unknown> | null;
  fehler_text: string | null;
  created_at: string;
}
