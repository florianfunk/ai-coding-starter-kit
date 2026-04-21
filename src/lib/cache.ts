/**
 * PROJ-33: Cache-Helper für Slowly-Changing-Daten.
 *
 * Wichtig: unstable_cache cached nur das Rückgabewert-JSON. Der Supabase-Client
 * wird INNERHALB der gecachten Funktion instanziiert — Client-Objekte sind
 * selbst nicht cacheable (Funktionen/Promises).
 *
 * Invalidierung via revalidateTag() aus den Server-Actions:
 *   - "bereiche"  bei bereiche CRUD
 *   - "kategorien" bei kategorien CRUD
 *   - "dashboard" bei Produkt/Preis-Writes
 */

import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DashboardStats } from "@/lib/types/views";

// ---------------------------------------------------------------------------
// Bereiche-Liste (sortiert nach sortierung)
// ---------------------------------------------------------------------------
export type CachedBereich = {
  id: string;
  name: string;
  sortierung: number;
  bild_path: string | null;
  farbe: string | null;
};

export const getBereiche = unstable_cache(
  async (): Promise<CachedBereich[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bereiche")
      .select("id, name, sortierung, bild_path, farbe")
      .order("sortierung", { ascending: true })
      .limit(1000);

    if (error) {
      console.error("getBereiche error:", error);
      return [];
    }
    return (data ?? []) as CachedBereich[];
  },
  ["bereiche-list-v1"],
  { tags: ["bereiche"], revalidate: 3600 },
);

// ---------------------------------------------------------------------------
// Kategorien-Liste (sortiert nach name)
// ---------------------------------------------------------------------------
export type CachedKategorie = {
  id: string;
  name: string;
  bereich_id: string;
  sortierung: number;
  vorschaubild_path: string | null;
};

export const getKategorien = unstable_cache(
  async (): Promise<CachedKategorie[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("kategorien")
      .select("id, name, bereich_id, sortierung, vorschaubild_path")
      .order("name", { ascending: true })
      .limit(5000);

    if (error) {
      console.error("getKategorien error:", error);
      return [];
    }
    return (data ?? []) as CachedKategorie[];
  },
  ["kategorien-list-v1"],
  { tags: ["kategorien"], revalidate: 3600 },
);

// ---------------------------------------------------------------------------
// Dashboard-Stats (eine Zeile aus v_dashboard_stats)
// ---------------------------------------------------------------------------
export const getDashboardStats = unstable_cache(
  async (): Promise<DashboardStats | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_dashboard_stats")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("getDashboardStats error:", error);
      return null;
    }
    return (data ?? null) as DashboardStats | null;
  },
  ["dashboard-stats-v1"],
  { tags: ["dashboard"], revalidate: 60 },
);
