// PROJ-16 — Helfer fuer den Lernregel-Vorschlag nach Anlage eines
// Arbeitgebers.
//
// Wir suchen im Kontenrahmen eine Kategorie, die fuer "Privat: Lohn/
// Gehalt aus Anstellung" passt:
//   - Bezeichnung enthaelt "Lohn", "Gehalt" oder "Anstellung"
//     (case-insensitiv)
//   - typ ∈ {'privat','neutral'}
//   - aktiv = true
//
// Bei mehreren Treffern: bevorzugt typ='privat', sonst die kuerzeste
// Bezeichnung (heuristisch der „spezifischste" Treffer).
//
// Keine Kategorie gefunden → null. Die API gibt dann keinen Vorschlag
// an die UI zurueck.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface LernregelVorschlag {
  empfaenger_muster: string;
  vorgeschlagene_kategorie_id: string;
  vorgeschlagene_kategorie_bezeichnung: string;
  klassifikation: "privat";
  prioritaet: number;
}

interface KategorieRow {
  id: string;
  bezeichnung: string;
  typ: "einnahme" | "ausgabe" | "privat" | "neutral";
}

const REGEX = /(lohn|gehalt|anstellung)/iu;

export async function ermittleLohnKategorie(
  supabase: SupabaseClient,
  owner_id: string,
): Promise<{ id: string; bezeichnung: string } | null> {
  const { data, error } = await supabase
    .from("kategorie")
    .select("id, bezeichnung, typ")
    .eq("owner_id", owner_id)
    .eq("aktiv", true)
    .in("typ", ["privat", "neutral"])
    .limit(200);
  if (error || !data) return null;

  const rows = data as KategorieRow[];
  const treffer = rows.filter((k) => REGEX.test(k.bezeichnung));
  if (treffer.length === 0) return null;

  treffer.sort((a, b) => {
    // typ='privat' zuerst, dann kuerzeste Bezeichnung.
    if (a.typ === "privat" && b.typ !== "privat") return -1;
    if (b.typ === "privat" && a.typ !== "privat") return 1;
    return a.bezeichnung.length - b.bezeichnung.length;
  });

  return { id: treffer[0].id, bezeichnung: treffer[0].bezeichnung };
}

export function baueLernregelVorschlag(
  name_normalisiert: string,
  kategorie: { id: string; bezeichnung: string },
): LernregelVorschlag {
  return {
    empfaenger_muster: name_normalisiert,
    vorgeschlagene_kategorie_id: kategorie.id,
    vorgeschlagene_kategorie_bezeichnung: kategorie.bezeichnung,
    klassifikation: "privat",
    prioritaet: 100,
  };
}
