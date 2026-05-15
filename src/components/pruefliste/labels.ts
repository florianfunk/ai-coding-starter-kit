// PROJ-7: gemeinsame Anzeige-Labels/Formatierer für die Prüfliste.

import type { Klassifikation } from "@/lib/types";

export const KLASS_LABEL: Record<Klassifikation, string> = {
  privat: "Privat",
  geschaeftlich: "Geschäftlich",
  unklar: "Unklar",
  neutral: "Neutral",
};

/** Klartext für die (kommaseparierten) Prüfgründe der Pipeline. */
export const GRUND_LABEL: Record<string, string> = {
  konfidenz_unter_schwellwert: "Niedrige Konfidenz",
  keine_kategorie: "Keine Kategorie",
  klassifikation_unklar: "Klassifikation unklar",
  ausreisser_betrag: "Betrag über Limit",
  regelkonflikt: "Regelkonflikt",
  ki_nicht_verfuegbar: "KI nicht verfügbar",
};

export function grundLabel(grund: string): string {
  return GRUND_LABEL[grund] ?? grund;
}

export function gruendeListe(pruef_grund: string | null): string[] {
  if (!pruef_grund) return [];
  return pruef_grund
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

export function formatBetrag(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDatum(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
