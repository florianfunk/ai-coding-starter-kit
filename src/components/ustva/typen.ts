// PROJ-8: Geteilte Client-Typen für die USt-VA-Ansicht (Spiegel der
// /api/steuer/ust-Antwort).

export interface KennzahlZeileDTO {
  schluessel: string;
  kennzahl: string;
  bezeichnung: string;
  betrag: number;
  steuer: number | null;
  buchung_ids: string[];
}

export interface UstBerechnungDTO {
  jahr: number;
  periode: number;
  kleinunternehmer: boolean;
  hinweis: string | null;
  zeilen: KennzahlZeileDTO[];
  summe: {
    umsatz_netto: number;
    umsatzsteuer: number;
    vorsteuer_abziehbar: number;
    zahllast: number;
  };
  diagnostik: {
    vorsteuer_ohne_beleg_anzahl: number;
    vorsteuer_ohne_beleg_betrag: number;
    ohne_ust_satz_anzahl: number;
    beruecksichtigt_anzahl: number;
  };
}

export interface UstWarnungen {
  offene_pruefung: number;
  unklassifiziert: number;
  geschaeft_ohne_beleg: number;
  vorsteuer_ohne_beleg: number;
  datum_unklar: number;
  ohne_ust_satz: number;
}

export interface BuchungDetailDTO {
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
  belegt: boolean;
}

export interface UstApiResponse {
  jahr: number;
  periode: number;
  periode_label: string;
  rhythmus: string;
  buchung_details: Record<string, BuchungDetailDTO>;
  status: "offen" | "geprueft" | "abgeschlossen";
  abgeschlossen_at: string | null;
  berechnung: UstBerechnungDTO;
  live_berechnung: UstBerechnungDTO;
  berichtigungshinweis: string | null;
  jahresuebersicht: Array<{
    periode: number;
    label: string;
    start: string;
    ende: string;
  }>;
  warnungen: UstWarnungen;
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}
