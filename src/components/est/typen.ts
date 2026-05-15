// PROJ-10: Geteilte DTO-Typen & Formatierungs-Helfer für die ESt-Ansicht.
// Spiegelt die Response-Form von GET /api/steuer/est (deterministisch).

export type Veranlagung = "einzel" | "zusammen";

export interface EstSchaetzung {
  jahr: number;
  veranlagung: Veranlagung;
  tarif_aus_db: boolean;
  zu_versteuerndes_einkommen: number;
  bemessungsgrundlage: number;
  einkommensteuer: number;
  soli: number;
  gesamtbelastung: number;
  effektiver_steuersatz: number;
  grenzsteuersatz: number;
  vorauszahlungen: number;
  abschlusszahlung: number;
  hinweise: string[];
}

export interface PrivatEntnahmeZeile {
  id: string;
  buchung_datum: string;
  konto: string;
  betrag: number;
  betrag_brutto: number;
  anteil: number;
  empfaenger: string | null;
  verwendungszweck: string | null;
  kategorie: string | null;
}

export interface EstApiResponse {
  jahr: number;
  veranlagung: Veranlagung;
  abgeschlossen: boolean;
  zeitraum: { von: string; bis: string };
  euer_gewinn: number;
  schaetzung: EstSchaetzung;
  privatentnahmen: {
    anzahl: number;
    summe: number;
    zeilen: PrivatEntnahmeZeile[];
  };
  disclaimer: string;
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export function formatProzent(anteil: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(anteil);
}

export function formatDatum(iso: string | null): string {
  if (!iso) return "–";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
