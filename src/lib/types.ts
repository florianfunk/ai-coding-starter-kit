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

export interface Lernregel {
  id: string;
  bezeichnung: string;
  bedingung: {
    empfaenger_muster?: string;
    zweck_muster?: string;
    konto_id?: string;
    betrag_min?: number;
    betrag_max?: number;
  };
  aktion: {
    kategorie_id?: string;
    ust_satz?: number;
    klassifikation?: Klassifikation;
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
