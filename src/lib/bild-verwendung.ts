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
  /** Hierarchie-Kontext: Bereich-ID (für Filter-Lookups) */
  bereichId?: string | null;
  /** Hierarchie-Kontext: Bereich-Name (für UI) */
  bereichName?: string | null;
  /** Hierarchie-Kontext: Kategorie-ID (für Filter-Lookups) */
  kategorieId?: string | null;
  /** Hierarchie-Kontext: Kategorie-Name (für UI) */
  kategorieName?: string | null;
  /** Slot-Index 1..N (Reihenfolge der Path-Spalten) — für „Bild 2 von 4"-Anzeige */
  slotIndex?: number;
  /** Sprechender Slot-Label (z.B. "Bild 1", "Hauptbild", "Detail-Bild 2") */
  slotLabel?: string;
}

const KATEGORIE_SLOT_LABELS: Record<string, { index: number; label: string }> = {
  bild1_path: { index: 1, label: "Bild 1" },
  bild2_path: { index: 2, label: "Bild 2" },
  bild3_path: { index: 3, label: "Bild 3" },
  bild4_path: { index: 4, label: "Bild 4" },
};

const PRODUKT_SLOT_LABELS: Record<string, { index: number; label: string }> = {
  hauptbild_path: { index: 1, label: "Hauptbild" },
  bild_detail_1_path: { index: 2, label: "Detail 1" },
  bild_detail_2_path: { index: 3, label: "Detail 2" },
  bild_zeichnung_1_path: { index: 4, label: "Zeichnung 1" },
  bild_zeichnung_2_path: { index: 5, label: "Zeichnung 2" },
  bild_zeichnung_3_path: { index: 6, label: "Zeichnung 3" },
  bild_energielabel_path: { index: 7, label: "Energielabel" },
};

const KATALOG_SLOT_LABELS: Record<string, string> = {
  cover_vorne_path: "Cover vorne",
  cover_hinten_path: "Cover hinten",
  logo_lichtengros_dunkel: "Logo Lichtengros (dunkel)",
  logo_lichtengros_hell: "Logo Lichtengros (hell)",
  logo_eisenkeil_dunkel: "Logo Eisenkeil (dunkel)",
  logo_eisenkeil_hell: "Logo Eisenkeil (hell)",
  logo_lichtstudio: "Logo Lichtstudio",
};

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

  // Joins via Foreign-Key-Hint: kategorien.bereich_id → bereiche.id,
  // produkte.bereich_id → bereiche.id, produkte.kategorie_id → kategorien.id
  const [bereiche, kategorien, produkte, katalog] = await Promise.all([
    supabase.from("bereiche").select("id, name").eq("bild_path", path),
    supabase
      .from("kategorien")
      .select(
        "id, name, bereich_id, bild1_path, bild2_path, bild3_path, bild4_path, bereich:bereiche(name)",
      )
      .or(KATEGORIE_BILD_SPALTEN.map((c) => `${c}.eq.${path}`).join(",")),
    supabase
      .from("produkte")
      .select(
        "id, artikelnummer, name, bereich_id, kategorie_id, hauptbild_path, bild_detail_1_path, bild_detail_2_path, bild_zeichnung_1_path, bild_zeichnung_2_path, bild_zeichnung_3_path, bild_energielabel_path, bereich:bereiche(name), kategorie:kategorien(name)",
      )
      .or(PRODUKT_BILD_SPALTEN.map((c) => `${c}.eq.${path}`).join(",")),
    supabase.from("katalog_einstellungen").select("*").eq("id", 1).single(),
  ]);

  for (const row of bereiche.data ?? []) {
    result.push({
      entityType: "bereich",
      entityId: row.id,
      label: row.name,
      slot: "bild_path",
      slotLabel: "Bereichsbild",
      editUrl: `/bereiche/${row.id}/bearbeiten`,
      bereichId: row.id,
      bereichName: row.name,
    });
  }

  for (const row of kategorien.data ?? []) {
    const bereichName = pickName(row.bereich);
    for (const col of KATEGORIE_BILD_SPALTEN) {
      if ((row as Record<string, unknown>)[col] === path) {
        const slot = KATEGORIE_SLOT_LABELS[col];
        result.push({
          entityType: "kategorie",
          entityId: row.id,
          label: row.name,
          slot: col,
          slotIndex: slot.index,
          slotLabel: slot.label,
          editUrl: `/kategorien/${row.id}/bearbeiten`,
          bereichId: row.bereich_id ?? null,
          bereichName,
          kategorieId: row.id,
          kategorieName: row.name,
        });
      }
    }
  }

  for (const row of produkte.data ?? []) {
    const bereichName = pickName(row.bereich);
    const kategorieName = pickName(row.kategorie);
    for (const col of PRODUKT_BILD_SPALTEN) {
      if ((row as Record<string, unknown>)[col] === path) {
        const slot = PRODUKT_SLOT_LABELS[col];
        const labelParts = [row.artikelnummer, row.name].filter(Boolean);
        result.push({
          entityType: "produkt",
          entityId: row.id,
          label: labelParts.join(" — ") || "(unbenannt)",
          slot: col,
          slotIndex: slot.index,
          slotLabel: slot.label,
          editUrl: `/produkte/${row.id}`,
          bereichId: row.bereich_id ?? null,
          bereichName,
          kategorieId: row.kategorie_id ?? null,
          kategorieName,
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
          slotLabel: KATALOG_SLOT_LABELS[col] ?? col,
          editUrl: "/einstellungen",
        });
      }
    }
  }

  return result;
}

/** Helfer: Supabase-Joins können je nach Konstellation Array oder Objekt liefern. */
function pickName(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string } | undefined;
    return first?.name ?? null;
  }
  if (typeof value === "object" && "name" in (value as Record<string, unknown>)) {
    const v = (value as { name?: string }).name;
    return v ?? null;
  }
  return null;
}

/**
 * Baut einen sprechenden Mediathek-Titel aus den Verwendungen.
 * Beispiele:
 *   "(unbenutzt)"
 *   "Bereiche / Spots — Bereichsbild"
 *   "Spots / LED-Strips / Strip 24V — Bild 2 von 4"
 *   "Spots / LED-Strips / 12345 — Hauptbild"
 *   "Spots / LED-Strips / 12345 — Hauptbild · +2 weitere"
 */
export function buildMediathekTitle(verwendungen: BildVerwendung[]): string {
  if (verwendungen.length === 0) return "(unbenutzt)";

  // Priorität: Produkt > Kategorie > Bereich > Katalog
  const order: EntityType[] = ["produkt", "kategorie", "bereich", "katalog-einstellungen"];
  const sorted = [...verwendungen].sort(
    (a, b) => order.indexOf(a.entityType) - order.indexOf(b.entityType),
  );
  const primary = sorted[0];

  const parts: string[] = [];
  if (primary.bereichName) parts.push(primary.bereichName);
  if (primary.kategorieName && primary.kategorieName !== primary.bereichName) {
    parts.push(primary.kategorieName);
  }
  if (primary.label && primary.label !== primary.kategorieName && primary.label !== primary.bereichName) {
    parts.push(primary.label);
  }

  let title = parts.join(" / ") || primary.label;
  if (primary.slotLabel) title += ` — ${primary.slotLabel}`;

  if (verwendungen.length > 1) {
    title += ` · +${verwendungen.length - 1} weitere`;
  }
  return title;
}

/**
 * Lädt alle Verwendungen aus allen Tabellen in einer Query-Runde und gibt
 * eine Map path -> BildVerwendung[] zurück. Das ist die effizienteste Form
 * für die Mediathek-Listenansicht: 4 Queries für beliebig viele Bilder.
 */
export async function buildBildVerwendungenIndex(
  supabase: SupabaseClient,
): Promise<Map<string, BildVerwendung[]>> {
  const index = new Map<string, BildVerwendung[]>();

  const push = (path: string | null | undefined, v: BildVerwendung) => {
    if (!path) return;
    const arr = index.get(path) ?? [];
    arr.push(v);
    index.set(path, arr);
  };

  const [bereiche, kategorien, produkte, katalog] = await Promise.all([
    supabase
      .from("bereiche")
      .select("id, name, bild_path")
      .not("bild_path", "is", null),
    supabase
      .from("kategorien")
      .select(
        "id, name, bereich_id, bild1_path, bild2_path, bild3_path, bild4_path, bereich:bereiche(name)",
      ),
    supabase
      .from("produkte")
      .select(
        "id, artikelnummer, name, bereich_id, kategorie_id, hauptbild_path, bild_detail_1_path, bild_detail_2_path, bild_zeichnung_1_path, bild_zeichnung_2_path, bild_zeichnung_3_path, bild_energielabel_path, bereich:bereiche(name), kategorie:kategorien(name)",
      ),
    supabase.from("katalog_einstellungen").select("*").eq("id", 1).single(),
  ]);

  for (const row of bereiche.data ?? []) {
    push(row.bild_path, {
      entityType: "bereich",
      entityId: row.id,
      label: row.name,
      slot: "bild_path",
      slotLabel: "Bereichsbild",
      editUrl: `/bereiche/${row.id}/bearbeiten`,
      bereichId: row.id,
      bereichName: row.name,
    });
  }

  for (const row of kategorien.data ?? []) {
    const bereichName = pickName(row.bereich);
    for (const col of KATEGORIE_BILD_SPALTEN) {
      const path = (row as Record<string, unknown>)[col] as string | null;
      if (!path) continue;
      const slot = KATEGORIE_SLOT_LABELS[col];
      push(path, {
        entityType: "kategorie",
        entityId: row.id,
        label: row.name,
        slot: col,
        slotIndex: slot.index,
        slotLabel: slot.label,
        editUrl: `/kategorien/${row.id}/bearbeiten`,
        bereichId: row.bereich_id ?? null,
        bereichName,
        kategorieId: row.id,
        kategorieName: row.name,
      });
    }
  }

  for (const row of produkte.data ?? []) {
    const bereichName = pickName(row.bereich);
    const kategorieName = pickName(row.kategorie);
    for (const col of PRODUKT_BILD_SPALTEN) {
      const path = (row as Record<string, unknown>)[col] as string | null;
      if (!path) continue;
      const slot = PRODUKT_SLOT_LABELS[col];
      const labelParts = [row.artikelnummer, row.name].filter(Boolean);
      push(path, {
        entityType: "produkt",
        entityId: row.id,
        label: labelParts.join(" — ") || "(unbenannt)",
        slot: col,
        slotIndex: slot.index,
        slotLabel: slot.label,
        editUrl: `/produkte/${row.id}`,
        bereichId: row.bereich_id ?? null,
        bereichName,
        kategorieId: row.kategorie_id ?? null,
        kategorieName,
      });
    }
  }

  if (katalog.data) {
    const row = katalog.data as Record<string, unknown>;
    for (const col of KATALOG_BILD_SPALTEN) {
      const v = row[col];
      if (typeof v === "string") {
        push(v, {
          entityType: "katalog-einstellungen",
          entityId: "1",
          label: "Katalog & Logos",
          slot: col,
          slotLabel: KATALOG_SLOT_LABELS[col] ?? col,
          editUrl: "/einstellungen",
        });
      }
    }
  }

  return index;
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
