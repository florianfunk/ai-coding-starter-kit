// PROJ-15 P2 (#3): "Häufige Prüflisten-Empfänger" — reine Aggregation (kein IO).
//
// Aus minimal geladenen Prüflisten-Buchungen (status='zur_pruefung' bzw.
// pruef_grund gesetzt) eine nach Häufigkeit sortierte Kandidatenliste für neue
// Lernregeln bauen: pro normalisiertem Empfänger Anzahl, Beispiel-Rohwert,
// Summe/Durchschnitt (Absolutbeträge), jüngstes Datum und die distinct
// Prüf-Gründe. Owner-Scoping/RLS und Jahres-Filter passieren in der Route, hier
// ausschließlich die Gruppierung — damit testbar ohne Supabase-Mock.

/** Minimal benötigte Felder einer Prüflisten-Buchung. */
export interface PrueflistenZeile {
  empfaenger_normalisiert: string | null;
  empfaenger: string | null;
  betrag: number | null;
  buchung_datum: string | null;
  pruef_grund: string | null;
}

/** Aggregat pro normalisiertem Empfänger. */
export interface HaeufigerEmpfaenger {
  empfaenger_norm: string;
  /** Roh-Empfänger einer Beispiel-Buchung (für die Anzeige). */
  beispiel_rohwert: string;
  anzahl: number;
  /** Summe der Absolutbeträge (gerundet, 2 NK). */
  summe: number;
  /** Mittlerer Absolutbetrag (gerundet, 2 NK). */
  durchschnitt: number;
  /** ISO-Datum der jüngsten Buchung. */
  letzte: string | null;
  /** Distinct Prüf-Gründe, die für diesen Empfänger aufgetreten sind. */
  pruef_gruende: string[];
}

export interface AggregierungOptions {
  /** Nur Gruppen mit mindestens so vielen Treffern. Default 1. */
  min_anzahl?: number;
  /** Obergrenze für die Ergebnisliste (häufigste zuerst). */
  limit?: number;
}

function runde2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Gruppiert Prüflisten-Buchungen nach `empfaenger_normalisiert`. Zeilen ohne
 * (leeren) normalisierten Empfänger werden ignoriert — für sie lässt sich keine
 * sinnvolle Lernregel ableiten. Sortierung: Anzahl absteigend, bei Gleichstand
 * Summe absteigend, dann Name (stabil/deterministisch).
 */
export function aggregiereHaeufigeEmpfaenger(
  zeilen: PrueflistenZeile[],
  opts: AggregierungOptions = {},
): HaeufigerEmpfaenger[] {
  const minAnzahl = opts.min_anzahl ?? 1;

  interface Akku {
    empfaenger_norm: string;
    beispiel_rohwert: string;
    anzahl: number;
    summeAbs: number;
    letzte: string | null;
    gruende: Set<string>;
  }

  const gruppen = new Map<string, Akku>();

  for (const z of zeilen) {
    const norm = (z.empfaenger_normalisiert ?? "").trim();
    if (!norm) continue;

    let g = gruppen.get(norm);
    if (!g) {
      g = {
        empfaenger_norm: norm,
        beispiel_rohwert: (z.empfaenger ?? "").trim() || norm,
        anzahl: 0,
        summeAbs: 0,
        letzte: null,
        gruende: new Set<string>(),
      };
      gruppen.set(norm, g);
    }

    g.anzahl += 1;
    g.summeAbs += Math.abs(z.betrag ?? 0);

    if (z.buchung_datum && (g.letzte === null || z.buchung_datum > g.letzte)) {
      g.letzte = z.buchung_datum;
    }

    // pruef_grund ist eine (evtl. kommaseparierte) Liste von Gründen.
    if (z.pruef_grund) {
      for (const teil of z.pruef_grund.split(",")) {
        const t = teil.trim();
        if (t) g.gruende.add(t);
      }
    }
  }

  let ergebnis: HaeufigerEmpfaenger[] = Array.from(gruppen.values())
    .filter((g) => g.anzahl >= minAnzahl)
    .map((g) => ({
      empfaenger_norm: g.empfaenger_norm,
      beispiel_rohwert: g.beispiel_rohwert,
      anzahl: g.anzahl,
      summe: runde2(g.summeAbs),
      durchschnitt: runde2(g.summeAbs / g.anzahl),
      letzte: g.letzte,
      pruef_gruende: Array.from(g.gruende),
    }))
    .sort(
      (a, b) =>
        b.anzahl - a.anzahl ||
        b.summe - a.summe ||
        a.empfaenger_norm.localeCompare(b.empfaenger_norm),
    );

  if (opts.limit != null && opts.limit >= 0) {
    ergebnis = ergebnis.slice(0, opts.limit);
  }

  return ergebnis;
}
