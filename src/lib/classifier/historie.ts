// PROJ-15 — Buchungs-Historie pro Empfaenger als LLM-Kontext.
//
// Liefert eine kompakte Zusammenfassung der bisherigen Buchungen fuer den
// gleichen normalisierten Empfaenger: Anzahl, Betragsspanne, Median, die
// haeufigste Kategorie und die haeufigste Klassifikation. Erkennt damit
// Abos und wiederkehrende Muster — der Agent sieht beim Erst-Lauf nicht nur
// die aktuelle Buchung, sondern auch die Vorgeschichte.
//
// Bewusst eine einzige SELECT-Query mit Limit 50 (genug fuer ein stabiles
// Aggregat, schont die DB). Aggregation in JS, weil Supabase RPC fuer Median
// nicht trivial waere und die Datenmenge winzig ist.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Klassifikation } from "@/lib/types";

export interface HistorieSummary {
  anzahl: number;
  betrag_min: number;
  betrag_max: number;
  betrag_median: number;
  haeufigste_kategorie_id: string | null;
  haeufigste_kategorie_anzahl: number;
  haeufigste_klassifikation: Klassifikation | null;
}

export interface HoleAehnlicheOptionen {
  ausschluss_id?: string;
  limit?: number;
}

interface HistorieRow {
  betrag: number;
  kategorie_id: string | null;
  klassifikation: Klassifikation | null;
}

/**
 * Sucht bis zu N bereits klassifizierte Buchungen mit gleichem
 * normalisierten Empfaenger und liefert ein Aggregat. Filtert auf
 *  - eigenen Owner (Defense-in-Depth ueber RLS hinaus),
 *  - finalisierten Status (auto_verbucht / manuell_bestaetigt),
 *  - schliesst die aktuelle Buchung (ausschluss_id) aus.
 *
 * Liefert null bei 0 Treffern oder DB-Fehler.
 */
export async function holeAehnlicheBuchungen(
  supabase: SupabaseClient,
  owner_id: string,
  empfaenger_normalisiert: string | null,
  optionen: HoleAehnlicheOptionen = {},
): Promise<HistorieSummary | null> {
  const norm = (empfaenger_normalisiert ?? "").trim();
  if (norm.length === 0) return null;

  const limit = optionen.limit ?? 50;

  let query = supabase
    .from("buchung")
    .select("betrag, kategorie_id, klassifikation")
    .eq("owner_id", owner_id)
    .eq("empfaenger_normalisiert", norm)
    .in("status", ["auto_verbucht", "manuell_bestaetigt"]);

  if (optionen.ausschluss_id) {
    query = query.neq("id", optionen.ausschluss_id);
  }

  const { data, error } = await query.limit(limit);
  if (error || !data || data.length === 0) return null;

  const rows = (data as HistorieRow[]).filter(
    (r) => typeof r.betrag === "number",
  );
  if (rows.length === 0) return null;

  return aggregiere(rows);
}

/**
 * REINE Aggregations-Funktion (testbar ohne DB).
 */
export function aggregiere(rows: HistorieRow[]): HistorieSummary {
  const betraege = rows.map((r) => r.betrag).sort((a, b) => a - b);
  const min = betraege[0];
  const max = betraege[betraege.length - 1];
  const median = berechneMedian(betraege);

  const katZaehler = new Map<string, number>();
  const klassZaehler = new Map<Klassifikation, number>();
  for (const r of rows) {
    if (r.kategorie_id) {
      katZaehler.set(r.kategorie_id, (katZaehler.get(r.kategorie_id) ?? 0) + 1);
    }
    if (r.klassifikation) {
      klassZaehler.set(
        r.klassifikation,
        (klassZaehler.get(r.klassifikation) ?? 0) + 1,
      );
    }
  }

  const haeufigsteKat = max1(katZaehler);
  const haeufigsteKlass = max1(klassZaehler);

  return {
    anzahl: rows.length,
    betrag_min: min,
    betrag_max: max,
    betrag_median: median,
    haeufigste_kategorie_id: haeufigsteKat?.key ?? null,
    haeufigste_kategorie_anzahl: haeufigsteKat?.count ?? 0,
    haeufigste_klassifikation: (haeufigsteKlass?.key as Klassifikation) ?? null,
  };
}

function berechneMedian(sortiert: number[]): number {
  const n = sortiert.length;
  if (n === 0) return 0;
  const mitte = Math.floor(n / 2);
  if (n % 2 === 1) return sortiert[mitte];
  return (sortiert[mitte - 1] + sortiert[mitte]) / 2;
}

function max1<K>(zaehler: Map<K, number>): { key: K; count: number } | null {
  let best: { key: K; count: number } | null = null;
  for (const [key, count] of zaehler) {
    if (!best || count > best.count) {
      best = { key, count };
    }
  }
  return best;
}
