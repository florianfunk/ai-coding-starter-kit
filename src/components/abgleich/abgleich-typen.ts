// PROJ-6: Geteilte UI-Typen für die Abgleich-Ansicht.

import type { ScoreBreakdown } from "@/lib/matching/score";

export interface BuchungKurz {
  id: string;
  konto_id: string;
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
  waehrung: string;
  klassifikation: "privat" | "geschaeftlich" | "unklar" | "neutral" | null;
}

export interface BelegKurz {
  id: string;
  paperless_id: number;
  titel: string | null;
  beleg_datum: string | null;
  korrespondent: string | null;
  betrag: number | null;
  status: "importiert" | "unvollstaendig" | "quelle_entfernt";
  quell_link: string | null;
}

export interface UnsichererMatch {
  id: string;
  match_score: number | null;
  kriterien: ScoreBreakdown | null;
  beleg: BelegKurz | null;
  buchung: BuchungKurz | null;
}

export interface FehllisteResponse {
  fehlliste_a: BuchungKurz[];
  fehlliste_b: BelegKurz[];
  unsichere_matches: UnsichererMatch[];
  zusammenfassung: {
    geschaeftsbuchungen: number;
    buchungen_ohne_beleg: number;
    belege_gesamt: number;
    belege_ohne_buchung: number;
    unsicher: number;
  };
}

export function formatDatum(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", { dateStyle: "medium" });
}

export function formatBetrag(
  betrag: number | null,
  waehrung = "EUR",
): string {
  if (betrag === null || betrag === undefined) return "–";
  return betrag.toLocaleString("de-DE", {
    style: "currency",
    currency: waehrung || "EUR",
  });
}
