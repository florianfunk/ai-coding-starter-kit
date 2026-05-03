-- 0025_produkt_vollstaendig_sections.sql
--
-- Pro Produkt eine Liste manuell-vollständiger Sektionen.
-- Wenn eine Section-ID hier eingetragen ist, gilt jeder Completeness-Bucket,
-- der dieser Section zugeordnet ist, als erfüllt — auch wenn die einzelnen
-- Felder leer sind.
--
-- Mapping Section → Completeness-Bucket (gespiegelt in src/lib/completeness.ts):
--   'datenblatt'         → has_datenblatt_titel, has_datenblatt_text, has_datenblatt_template
--   'datenblatt-bilder'  → has_galerie
--   'elektrisch'         → has_technik
--   'lichttechnisch'     → has_technik
--   'mechanisch'         → has_masse
--   'thermisch'          → has_technik
--   'icons'              → has_icon

ALTER TABLE public.produkte
  ADD COLUMN IF NOT EXISTS vollstaendig_sections text[] NOT NULL DEFAULT '{}';

-- Materialized View neu aufbauen — Bucket-Flags berücksichtigen jetzt die
-- Section-Markierungen.
DROP MATERIALIZED VIEW IF EXISTS public.mv_produkt_completeness CASCADE;

CREATE MATERIALIZED VIEW public.mv_produkt_completeness AS
WITH flags AS (
  SELECT
    p.id AS produkt_id,
    true AS has_artikelnummer,
    (p.name IS NOT NULL AND btrim(p.name) <> '') AS has_name,
    (p.kategorie_id IS NOT NULL) AS has_kategorie,
    (p.hauptbild_path IS NOT NULL) AS has_hauptbild,
    (ap.produkt_id IS NOT NULL) AS has_price,
    (
      (p.datenblatt_titel IS NOT NULL AND btrim(p.datenblatt_titel) <> '')
      OR 'datenblatt' = ANY(p.vollstaendig_sections)
    ) AS has_datenblatt_titel,
    (
      (p.datenblatt_text IS NOT NULL AND btrim(p.datenblatt_text) <> '')
      OR 'datenblatt' = ANY(p.vollstaendig_sections)
    ) AS has_datenblatt_text,
    (
      p.datenblatt_template_id IS NOT NULL
      OR 'datenblatt' = ANY(p.vollstaendig_sections)
    ) AS has_datenblatt_template,
    (
      p.leistung_w IS NOT NULL
      OR p.lichtstrom_lm IS NOT NULL
      OR p.farbtemperatur_k IS NOT NULL
      OR (p.schutzart_ip IS NOT NULL AND btrim(p.schutzart_ip) <> '')
      OR 'elektrisch' = ANY(p.vollstaendig_sections)
      OR 'lichttechnisch' = ANY(p.vollstaendig_sections)
      OR 'thermisch' = ANY(p.vollstaendig_sections)
    ) AS has_technik,
    (
      (p.masse_text IS NOT NULL AND btrim(p.masse_text) <> '')
      OR p.laenge_mm IS NOT NULL
      OR p.breite_mm IS NOT NULL
      OR p.hoehe_mm IS NOT NULL
      OR 'mechanisch' = ANY(p.vollstaendig_sections)
    ) AS has_masse,
    (
      EXISTS (SELECT 1 FROM public.produkt_bilder pb WHERE pb.produkt_id = p.id)
      OR 'datenblatt-bilder' = ANY(p.vollstaendig_sections)
    ) AS has_galerie,
    (
      EXISTS (SELECT 1 FROM public.produkt_icons pi WHERE pi.produkt_id = p.id)
      OR 'icons' = ANY(p.vollstaendig_sections)
    ) AS has_icon
  FROM public.produkte p
  LEFT JOIN public.aktuelle_preise_flat ap ON ap.produkt_id = p.id
),
earned AS (
  SELECT
    flags.produkt_id,
    flags.has_price, flags.has_hauptbild, flags.has_name,
    flags.has_datenblatt_titel, flags.has_datenblatt_text, flags.has_datenblatt_template,
    flags.has_technik, flags.has_masse, flags.has_galerie, flags.has_icon,
    (
        (CASE WHEN flags.has_artikelnummer      THEN 10 ELSE 0 END)
      + (CASE WHEN flags.has_name                THEN 10 ELSE 0 END)
      + (CASE WHEN flags.has_kategorie           THEN 10 ELSE 0 END)
      + (CASE WHEN flags.has_hauptbild           THEN 10 ELSE 0 END)
      + (CASE WHEN flags.has_price               THEN 10 ELSE 0 END)
      + (CASE WHEN flags.has_datenblatt_titel    THEN  7 ELSE 0 END)
      + (CASE WHEN flags.has_datenblatt_text     THEN  7 ELSE 0 END)
      + (CASE WHEN flags.has_datenblatt_template THEN  6 ELSE 0 END)
      + (CASE WHEN flags.has_technik             THEN  8 ELSE 0 END)
      + (CASE WHEN flags.has_masse               THEN  6 ELSE 0 END)
      + (CASE WHEN flags.has_galerie             THEN  3 ELSE 0 END)
      + (CASE WHEN flags.has_icon                THEN  3 ELSE 0 END)
    ) AS earned_points
  FROM flags
)
SELECT
  produkt_id,
  round(earned_points::numeric / 90.0 * 100.0)::int AS percent,
  (round(earned_points::numeric / 90.0 * 100.0)::int > 80) AS is_complete,
  has_price, has_hauptbild, has_name,
  has_datenblatt_titel, has_datenblatt_text, has_datenblatt_template,
  has_technik, has_masse, has_galerie, has_icon
FROM earned;

CREATE UNIQUE INDEX IF NOT EXISTS mv_produkt_completeness_produkt_id_idx
  ON public.mv_produkt_completeness (produkt_id);

REFRESH MATERIALIZED VIEW public.mv_produkt_completeness;

GRANT SELECT ON public.mv_produkt_completeness TO authenticated, service_role;

-- v_produkt_listing wurde durch CASCADE mitgelöscht — neu anlegen.
CREATE OR REPLACE VIEW public.v_produkt_listing AS
SELECT
  p.*,
  b.name AS bereich_name,
  k.name AS kategorie_name,
  (ap.produkt_id IS NOT NULL) AS hat_preis,
  (SELECT count(*) FROM public.produkt_icons pi WHERE pi.produkt_id = p.id)::int AS icon_count,
  (SELECT count(*) FROM public.produkt_bilder pb WHERE pb.produkt_id = p.id)::int AS galerie_count,
  COALESCE(mv.percent, 0) AS completeness_percent,
  COALESCE(mv.is_complete, false) AS completeness_complete
FROM public.produkte p
LEFT JOIN public.kategorien k ON k.id = p.kategorie_id
LEFT JOIN public.bereiche b ON b.id = k.bereich_id
LEFT JOIN public.aktuelle_preise_flat ap ON ap.produkt_id = p.id
LEFT JOIN public.mv_produkt_completeness mv ON mv.produkt_id = p.id;

GRANT SELECT ON public.v_produkt_listing TO authenticated, service_role;

-- v_dashboard_stats wurde durch CASCADE mitgelöscht — neu anlegen.
CREATE OR REPLACE VIEW public.v_dashboard_stats AS
WITH
  b_cnt   AS (SELECT count(*)::int AS c FROM public.bereiche),
  k_cnt   AS (SELECT count(*)::int AS c FROM public.kategorien),
  p_cnt   AS (SELECT count(*)::int AS c FROM public.produkte),
  pr_cnt  AS (SELECT count(*)::int AS c FROM public.preise),
  i_cnt   AS (SELECT count(*)::int AS c FROM public.icons),
  ohne_preis AS (
    SELECT count(*)::int AS c FROM public.produkte p
     WHERE NOT EXISTS (SELECT 1 FROM public.preise pr WHERE pr.produkt_id = p.id)
  ),
  ohne_aktiven_preis AS (
    SELECT count(*)::int AS c FROM public.produkte p
     WHERE NOT EXISTS (SELECT 1 FROM public.aktuelle_preise_flat ap WHERE ap.produkt_id = p.id)
  ),
  ohne_bild AS (
    SELECT count(*)::int AS c FROM public.produkte WHERE hauptbild_path IS NULL
  ),
  unbearbeitet AS (
    SELECT count(*)::int AS c FROM public.produkte WHERE artikel_bearbeitet = false
  ),
  mv_agg AS (
    SELECT
      COALESCE(round(avg(percent))::int, 0) AS avg_percent,
      count(*) FILTER (WHERE percent > 80)::int AS complete_count,
      count(*) FILTER (WHERE percent <= 80)::int AS needs_attention_count
    FROM public.mv_produkt_completeness
  )
SELECT
  b_cnt.c    AS bereiche_count,
  k_cnt.c    AS kategorien_count,
  p_cnt.c    AS produkte_count,
  pr_cnt.c   AS preise_count,
  i_cnt.c    AS icons_count,
  ohne_preis.c         AS ohne_preis_count,
  ohne_aktiven_preis.c AS ohne_aktiven_preis_count,
  ohne_bild.c          AS ohne_bild_count,
  unbearbeitet.c       AS unbearbeitet_count,
  mv_agg.avg_percent           AS avg_completeness,
  mv_agg.complete_count        AS complete_count,
  mv_agg.needs_attention_count AS needs_attention_count,
  CASE WHEN p_cnt.c = 0 THEN 0
       ELSE round(100.0 * mv_agg.complete_count / nullif(p_cnt.c, 0))::int END AS complete_percent
FROM b_cnt, k_cnt, p_cnt, pr_cnt, i_cnt,
     ohne_preis, ohne_aktiven_preis, ohne_bild, unbearbeitet, mv_agg;

GRANT SELECT ON public.v_dashboard_stats TO authenticated, service_role;
