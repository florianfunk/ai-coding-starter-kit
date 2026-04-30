/**
 * PROJ-43: Bild-Verwendungs-Lookup für Mediathek.
 *
 * Findet alle Records, die auf einen Storage-Pfad verweisen — quer durch
 * Bereiche, Kategorien, Produkte (inkl. Datenblatt-Slots) und Katalog-
 * Einstellungen (Cover, Logos).
 *
 * Performance: ein Aufruf macht parallele Queries gegen alle relevanten
 * Tabellen mit `or()`-Bedingungen über die Path-Spalten. Sollte bei
 * ~400 Produkten + ~70 Kategorien problemlos sein, weil pro Tabelle nur
 * Records mit Treffer zurückkommen.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type EntityType =
  | "bereich"
  | "kategorie"
  | "produkt"
  | "katalog-einstellungen";

export interface BildVerwendung {
  entityType: EntityType;
  entityId: string;
  /** Sprechender Name für UI (z.B. Produkt-Name oder Bereich-Name) */
  label: string;
  /** Optional: konkreter Slot/Spaltenname (z.B. "bild1_path", "hauptbild_path") */
  slot: string;
  /** URL zum Bearbeiten dieses Records (für „springe zu Verwendung") */
  editUrl: string;
}

const KATEGORIE_BILD_SPALTEN = [
  "bild1_path",
  "bild2_path",
  "bild3_path",
  "bild4_path",
] as const;

const PRODUKT_BILD_SPALTEN = [
  "hauptbild_path",
  "bild_detail_1_path",
  "bild_detail_2_path",
  "bild_zeichnung_1_path",
  "bild_zeichnung_2_path",
  "bild_zeichnung_3_path",
  "bild_energielabel_path",
] as const;

const KATALOG_BILD_SPALTEN = [
  "cover_vorne_path",
  "cover_hinten_path",
  "logo_lichtengros_dunkel",
  "logo_lichtengros_hell",
  "logo_eisenkeil_dunkel",
  "logo_eisenkeil_hell",
  "logo_lichtstudio",
] as const;

/** Findet alle Verwendungen eines Bild-Pfads quer durch alle Entitäten. */
export async function getBildVerwendungen(
  supabase: SupabaseClient,
  path: string,
): Promise<BildVerwendung[]> {
  const result: BildVerwendung[] = [];

  const [bereiche, kategorien, produkte, katalog] = await Promise.all([
    supabase.from("bereiche").select("id, name").eq("bild_path", path),
    supabase
      .from("kategorien")
      .select("id, name, bild1_path, bild2_path, bild3_path, bild4_path")
      .or(KATEGORIE_BILD_SPALTEN.map((c) => `${c}.eq.${path}`).join(",")),
    supabase
      .from("produkte")
      .select(
        "id, artikelnummer, name, hauptbild_path, bild_detail_1_path, bild_detail_2_path, bild_zeichnung_1_path, bild_zeichnung_2_path, bild_zeichnung_3_path, bild_energielabel_path",
      )
      .or(PRODUKT_BILD_SPALTEN.map((c) => `${c}.eq.${path}`).join(",")),
    supabase
      .from("katalog_einstellungen")
      .select("*")
      .eq("id", 1)
      .single(),
  ]);

  for (const row of bereiche.data ?? []) {
    result.push({
      entityType: "bereich",
      entityId: row.id,
      label: row.name,
      slot: "bild_path",
      editUrl: `/bereiche/${row.id}/bearbeiten`,
    });
  }

  for (const row of kategorien.data ?? []) {
    for (const col of KATEGORIE_BILD_SPALTEN) {
      if (row[col] === path) {
        result.push({
          entityType: "kategorie",
          entityId: row.id,
          label: row.name,
          slot: col,
          editUrl: `/kategorien/${row.id}/bearbeiten`,
        });
      }
    }
  }

  for (const row of produkte.data ?? []) {
    for (const col of PRODUKT_BILD_SPALTEN) {
      if (row[col] === path) {
        const labelParts = [row.artikelnummer, row.name].filter(Boolean);
        result.push({
          entityType: "produkt",
          entityId: row.id,
          label: labelParts.join(" — ") || "(unbenannt)",
          slot: col,
          editUrl: `/produkte/${row.id}`,
        });
      }
    }
  }

  if (katalog.data) {
    const row = katalog.data as Record<string, unknown>;
    for (const col of KATALOG_BILD_SPALTEN) {
      if (row[col] === path) {
        result.push({
          entityType: "katalog-einstellungen",
          entityId: "1",
          label: "Katalog & Logos",
          slot: col,
          editUrl: "/einstellungen",
        });
      }
    }
  }

  return result;
}

/**
 * Batch-Variante: für eine Liste von Pfaden ermittelt sie pro Pfad nur die
 * Anzahl der Verwendungen. Nutzbar für Mediathek-Listenansicht (Verwendet/
 * Unbenutzt Filter), ohne pro Bild eine separate Query zu fahren.
 */
export async function countBildVerwendungenBatch(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const p of paths) counts.set(p, 0);

  if (paths.length === 0) return counts;

  // Wir laden alle Records mit ihren Path-Spalten und zählen client-seitig.
  // Das ist effizient, weil wir nur eine Query pro Tabelle brauchen.
  const [bereiche, kategorien, produkte, katalog] = await Promise.all([
    supabase.from("bereiche").select("bild_path").not("bild_path", "is", null),
    supabase
      .from("kategorien")
      .select("bild1_path, bild2_path, bild3_path, bild4_path"),
    supabase
      .from("produkte")
      .select(
        "hauptbild_path, bild_detail_1_path, bild_detail_2_path, bild_zeichnung_1_path, bild_zeichnung_2_path, bild_zeichnung_3_path, bild_energielabel_path",
      ),
    supabase.from("katalog_einstellungen").select("*").eq("id", 1).single(),
  ]);

  const inc = (p: string | null | undefined) => {
    if (!p) return;
    if (counts.has(p)) counts.set(p, (counts.get(p) ?? 0) + 1);
  };

  for (const row of bereiche.data ?? []) inc(row.bild_path);
  for (const row of kategorien.data ?? []) {
    for (const col of KATEGORIE_BILD_SPALTEN) inc(row[col]);
  }
  for (const row of produkte.data ?? []) {
    for (const col of PRODUKT_BILD_SPALTEN) inc(row[col]);
  }
  if (katalog.data) {
    const row = katalog.data as Record<string, unknown>;
    for (const col of KATALOG_BILD_SPALTEN) {
      const v = row[col];
      if (typeof v === "string") inc(v);
    }
  }

  return counts;
}
