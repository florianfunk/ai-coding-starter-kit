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
  bild1_path: string | null;
  bild2_path: string | null;
  bild3_path: string | null;
  bild4_path: string | null;
};

export const getKategorien = unstable_cache(
  async (): Promise<CachedKategorie[]> => {
    const supabase = cacheClient();
    const { data, error } = await supabase
      .from("kategorien")
      .select("id, name, bereich_id, sortierung, bild1_path, bild2_path, bild3_path, bild4_path")
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

// ---------------------------------------------------------------------------
// Icons-Liste — wird im Produkt-Detail (Icon-Picker) und an vielen anderen
// Stellen benötigt. Ändert sich extrem selten.
// ---------------------------------------------------------------------------
export type CachedIcon = {
  id: string;
  label: string;
  gruppe: string | null;
  symbol_path: string | null;
};

export const getIcons = unstable_cache(
  async (): Promise<CachedIcon[]> => {
    const supabase = cacheClient();
    const { data, error } = await supabase
      .from("icons")
      .select("id, label, gruppe, symbol_path, sortierung")
      .order("gruppe")
      .order("sortierung")
      .order("label")
      .limit(2000);

    if (error) {
      console.error("getIcons error:", error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      gruppe: r.gruppe,
      symbol_path: r.symbol_path,
    })) as CachedIcon[];
  },
  ["icons-list-v1"],
  { tags: ["icons"], revalidate: 3600 },
);

// ---------------------------------------------------------------------------
// Datenblatt-Templates — system + custom, ändert sich nur durch Admin-Pflege.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Counts pro Bereich (kategorien_count + produkte_count). Wird auf der
// Bereiche-Listenpage und im Dashboard-Widget gebraucht. Identisch für alle
// User, ändert sich selten. Tag "produkte" wird via revalidateTag invalidiert
// wenn Produkte/Kategorien angelegt oder gelöscht werden.
// ---------------------------------------------------------------------------
export type BereichCounts = {
  bereich_id: string;
  kategorien_count: number;
  produkte_count: number;
};

export const getBereichCounts = unstable_cache(
  async (): Promise<BereichCounts[]> => {
    const supabase = cacheClient();
    // 2 leichte Queries (nur bereich_id), in JS aggregiert. Indizes auf
    // produkte.bereich_id und kategorien.bereich_id existieren.
    const [{ data: katStats }, { data: prodStats }] = await Promise.all([
      supabase.from("kategorien").select("bereich_id").limit(10000),
      supabase.from("produkte").select("bereich_id").limit(20000),
    ]);
    const katMap = new Map<string, number>();
    for (const r of katStats ?? []) katMap.set(r.bereich_id, (katMap.get(r.bereich_id) ?? 0) + 1);
    const prodMap = new Map<string, number>();
    for (const r of prodStats ?? []) prodMap.set(r.bereich_id, (prodMap.get(r.bereich_id) ?? 0) + 1);
    const ids = new Set<string>([...katMap.keys(), ...prodMap.keys()]);
    return Array.from(ids).map((id) => ({
      bereich_id: id,
      kategorien_count: katMap.get(id) ?? 0,
      produkte_count: prodMap.get(id) ?? 0,
    }));
  },
  ["bereich-counts-v1"],
  { tags: ["bereich-counts"], revalidate: 300 },
);

// ---------------------------------------------------------------------------
// Produkt-Counts pro Kategorie. Identisch für alle User.
// ---------------------------------------------------------------------------
export const getKategorieCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const supabase = cacheClient();
    const { data } = await supabase.from("produkte").select("kategorie_id").limit(20000);
    const out: Record<string, number> = {};
    for (const r of data ?? []) out[r.kategorie_id] = (out[r.kategorie_id] ?? 0) + 1;
    return out;
  },
  ["kategorie-counts-v1"],
  { tags: ["kategorie-counts"], revalidate: 300 },
);

// ---------------------------------------------------------------------------
// Icons pro Kategorie (Labels). Wird auf der Kategorien-Liste gebraucht.
// ---------------------------------------------------------------------------
export const getKategorieIconLabels = unstable_cache(
  async (): Promise<Record<string, string[]>> => {
    const supabase = cacheClient();
    const { data } = await supabase
      .from("kategorie_icons")
      .select("kategorie_id, icons(label)")
      .limit(20000);
    const out: Record<string, string[]> = {};
    for (const r of (data ?? []) as unknown as Array<{
      kategorie_id: string;
      icons: { label: string } | null;
    }>) {
      const arr = out[r.kategorie_id] ?? [];
      if (r.icons?.label) arr.push(r.icons.label);
      out[r.kategorie_id] = arr;
    }
    return out;
  },
  ["kategorie-icon-labels-v1"],
  { tags: ["kategorien", "icons"], revalidate: 3600 },
);

export const getDatenblattTemplates = unstable_cache(
  async (): Promise<any[]> => {
    const supabase = cacheClient();
    const { data, error } = await supabase
      .from("datenblatt_templates")
      .select("*")
      .order("is_system", { ascending: false })
      .order("sortierung");

    if (error) {
      console.error("getDatenblattTemplates error:", error);
      return [];
    }
    return data ?? [];
  },
  ["datenblatt-templates-v1"],
  { tags: ["datenblatt-templates"], revalidate: 3600 },
);
