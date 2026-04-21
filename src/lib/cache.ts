/**
 * PROJ-33: Cache-Helper für Slowly-Changing-Daten.
 *
 * Wichtig: unstable_cache verbietet cookies()/headers() innerhalb der
 * gecachten Funktion. Deswegen nutzen wir einen cookieless
 * Service-Role-Client (@supabase/supabase-js), nicht den SSR-Client.
 *
 * Das ist sicher, weil diese Daten nicht user-spezifisch sind:
 * - Bereiche, Kategorien und Dashboard-Stats sind identisch für alle
 *   authentifizierten User.
 * - Die Auth-Prüfung (User eingeloggt?) passiert in der Proxy-Middleware
 *   BEVOR die Page-Render-Funktion läuft.
 *
 * Invalidierung via revalidateTag(name, "max") aus den Server-Actions:
 *   - "bereiche"  bei bereiche CRUD
 *   - "kategorien" bei kategorien CRUD
 *   - "dashboard" bei Produkt/Preis-Writes
 */

import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { DashboardStats } from "@/lib/types/views";

function cacheClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

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
    const supabase = cacheClient();
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
    const supabase = cacheClient();
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
    const supabase = cacheClient();
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
