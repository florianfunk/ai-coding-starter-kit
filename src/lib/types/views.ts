/**
 * PROJ-33: TypeScript-Typen für die neuen DB-Views und Materialized Views.
 *
 * Diese Typen spiegeln die Spalten aus:
 *   - public.v_dashboard_stats
 *   - public.v_produkt_listing
 *   - public.mv_produkt_completeness
 *
 * Quelle: supabase/migrations/0013_perf_views.sql
 */

// ---------------------------------------------------------------------------
// v_dashboard_stats — eine Zeile, alle Kennzahlen fürs Dashboard
// ---------------------------------------------------------------------------
export type DashboardStats = {
  bereiche_count: number;
  kategorien_count: number;
  produkte_count: number;
  preise_count: number;
  icons_count: number;
  ohne_preis_count: number;
  ohne_bild_count: number;
  unbearbeitet_count: number;
  avg_completeness: number;
  complete_count: number;
  needs_attention_count: number;
  complete_percent: number;
};

// ---------------------------------------------------------------------------
// mv_produkt_completeness — pro Produkt ein Datensatz
// ---------------------------------------------------------------------------
export type ProduktCompleteness = {
  produkt_id: string;
  percent: number;
  is_complete: boolean;
  has_price: boolean;
  has_hauptbild: boolean;
  has_name: boolean;
  has_datenblatt_titel: boolean;
  has_datenblatt_text: boolean;
  has_datenblatt_template: boolean;
  has_technik: boolean;
  has_masse: boolean;
  has_galerie: boolean;
  has_icon: boolean;
};

// ---------------------------------------------------------------------------
// v_produkt_listing — Produkt-Zeile + gejointe Felder
// ---------------------------------------------------------------------------
// Hinweis: `p.*` im View wirft alle Produkt-Spalten aus. Hier deklarieren wir
// die Felder, die die Produktliste tatsächlich nutzt, und lassen den Rest
// offen (Record), damit neue Produkt-Spalten das Typ-Interface nicht brechen.
export type ProduktListing = {
  // Kern-Felder des Produkts (die die Produktliste verwendet)
  id: string;
  artikelnummer: string;
  name: string | null;
  bereich_id: string;
  kategorie_id: string;
  sortierung: number;
  artikel_bearbeitet: boolean;
  hauptbild_path: string | null;
  created_at: string;
  updated_at: string;

  // Gejointe Felder (neu via v_produkt_listing)
  bereich_name: string | null;
  kategorie_name: string | null;
  hat_preis: boolean;
  icon_count: number;
  galerie_count: number;
  completeness_percent: number;
  completeness_complete: boolean;

  // Offen lassen — produkte hat ~80 Spalten, nicht alle müssen typisiert werden.
  [key: string]: unknown;
};
