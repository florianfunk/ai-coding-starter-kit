-- Fix: View `aktuelle_preise` mergt die 3 FM-Preiszeilen pro Produkt zu einer Zeile.
--
-- FileMaker-Datenmodell: Pro (produkt, gueltig_ab) speichert FM 3 separate Zeilen —
-- eine mit Listenpreis, eine mit EK_Lichtengros, eine mit EK_Eisenkeil. Die jeweils
-- anderen Felder sind leer. Die ursprüngliche View nahm per DISTINCT ON nur EINE
-- Zeile pro Produkt (sortiert nach created_at DESC) — dadurch erschien Listenpreis
-- oft als 0, weil die zuletzt importierte Zeile die EK-Zeile war.
--
-- Fix: Aggregation über MAX ... FILTER (WHERE feld > 0) pro (produkt, gueltig_ab),
-- damit alle drei Teil-Preise in EINER Zeile landen.
--
-- Abhängige Views (v_produkt_listing, v_dashboard_stats, mv_produkt_completeness)
-- müssen dropped + neu erstellt werden, weil PostgreSQL CASCADE das erzwingt.

DROP VIEW IF EXISTS public.v_produkt_listing CASCADE;
DROP VIEW IF EXISTS public.v_dashboard_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_produkt_completeness CASCADE;
DROP VIEW IF EXISTS public.aktuelle_preise CASCADE;

-- 1. aktuelle_preise NEU: mergt die 3 FM-Preiszeilen pro Produkt
CREATE VIEW public.aktuelle_preise AS
WITH neueste_gueltig_ab AS (
  SELECT produkt_id, MAX(gueltig_ab) AS gueltig_ab
  FROM public.preise
  WHERE status = 'aktiv' AND gueltig_ab <= CURRENT_DATE
  GROUP BY produkt_id
)
SELECT
  p.produkt_id,
  (array_agg(p.id ORDER BY p.created_at DESC))[1] AS preis_id,
  p.gueltig_ab,
  MAX(p.listenpreis) FILTER (WHERE p.listenpreis > 0)::numeric(10,2) AS listenpreis,
  MAX(COALESCE(p.ek_lichtengros, p.ek)) FILTER (WHERE COALESCE(p.ek_lichtengros, p.ek) > 0)::numeric(10,2) AS ek,
  MAX(p.ek_lichtengros) FILTER (WHERE p.ek_lichtengros > 0)::numeric(10,2) AS ek_lichtengros,
  MAX(p.ek_eisenkeil) FILTER (WHERE p.ek_eisenkeil > 0)::numeric(10,2) AS ek_eisenkeil,
  'aktiv'::preis_status AS status
FROM public.preise p
JOIN neueste_gueltig_ab n ON n.produkt_id = p.produkt_id AND n.gueltig_ab = p.gueltig_ab
WHERE p.status = 'aktiv'
GROUP BY p.produkt_id, p.gueltig_ab;

-- 2. Materialized View Produkt-Completeness neu aufbauen (Logik unverändert)
CREATE MATERIALIZED VIEW public.mv_produkt_completeness AS
WITH flags AS (
  SELECT p.id AS produkt_id,
    true AS has_artikelnummer,
    ((p.name IS NOT NULL) AND (btrim(p.name) <> '')) AS has_name,
    (p.kategorie_id IS NOT NULL) AS has_kategorie,
    (p.hauptbild_path IS NOT NULL) AS has_hauptbild,
    (ap.produkt_id IS NOT NULL) AS has_price,
    ((p.datenblatt_titel IS NOT NULL) AND (btrim(p.datenblatt_titel) <> '')) AS has_datenblatt_titel,
    ((p.datenblatt_text IS NOT NULL) AND (btrim(p.datenblatt_text) <> '')) AS has_datenblatt_text,
    (p.datenblatt_template_id IS NOT NULL) AS has_datenblatt_template,
    ((p.leistung_w IS NOT NULL) OR (p.lichtstrom_lm IS NOT NULL) OR (p.farbtemperatur_k IS NOT NULL) OR ((p.schutzart_ip IS NOT NULL) AND (btrim(p.schutzart_ip) <> ''))) AS has_technik,
    (((p.masse_text IS NOT NULL) AND (btrim(p.masse_text) <> '')) OR (p.laenge_mm IS NOT NULL) OR (p.breite_mm IS NOT NULL) OR (p.hoehe_mm IS NOT NULL)) AS has_masse,
    (EXISTS (SELECT 1 FROM public.produkt_bilder pb WHERE pb.produkt_id = p.id)) AS has_galerie,
    (EXISTS (SELECT 1 FROM public.produkt_icons pi WHERE pi.produkt_id = p.id)) AS has_icon
  FROM public.produkte p
  LEFT JOIN public.aktuelle_preise ap ON ap.produkt_id = p.id
),
earned AS (
  SELECT flags.produkt_id, flags.has_price, flags.has_hauptbild, flags.has_name,
    flags.has_datenblatt_titel, flags.has_datenblatt_text, flags.has_datenblatt_template,
    flags.has_technik, flags.has_masse, flags.has_galerie, flags.has_icon,
    (
      CASE WHEN flags.has_artikelnummer THEN 10 ELSE 0 END +
      CASE WHEN flags.has_name THEN 10 ELSE 0 END +
      CASE WHEN flags.has_kategorie THEN 10 ELSE 0 END +
      CASE WHEN flags.has_hauptbild THEN 10 ELSE 0 END +
      CASE WHEN flags.has_price THEN 10 ELSE 0 END +
      CASE WHEN flags.has_datenblatt_titel THEN 7 ELSE 0 END +
      CASE WHEN flags.has_datenblatt_text THEN 7 ELSE 0 END +
      CASE WHEN flags.has_datenblatt_template THEN 6 ELSE 0 END +
      CASE WHEN flags.has_technik THEN 8 ELSE 0 END +
      CASE WHEN flags.has_masse THEN 6 ELSE 0 END +
      CASE WHEN flags.has_galerie THEN 3 ELSE 0 END +
      CASE WHEN flags.has_icon THEN 3 ELSE 0 END
    ) AS earned_points
  FROM flags
)
SELECT produkt_id,
  (round((earned_points::numeric / 90.0) * 100.0))::integer AS percent,
  ((round((earned_points::numeric / 90.0) * 100.0))::integer > 80) AS is_complete,
  has_price, has_hauptbild, has_name, has_datenblatt_titel, has_datenblatt_text,
  has_datenblatt_template, has_technik, has_masse, has_galerie, has_icon
FROM earned;

CREATE UNIQUE INDEX mv_produkt_completeness_produkt_id_idx
  ON public.mv_produkt_completeness (produkt_id);

-- 3. v_produkt_listing neu (mit SELECT p.*, um die Spalten-Liste zu sparen)
CREATE VIEW public.v_produkt_listing AS
SELECT p.*,
  b.name AS bereich_name,
  k.name AS kategorie_name,
  (ap.produkt_id IS NOT NULL) AS hat_preis,
  ((SELECT count(*) FROM public.produkt_icons pi WHERE pi.produkt_id = p.id))::integer AS icon_count,
  ((SELECT count(*) FROM public.produkt_bilder pb WHERE pb.produkt_id = p.id))::integer AS galerie_count,
  COALESCE(mv.percent, 0) AS completeness_percent,
  COALESCE(mv.is_complete, false) AS completeness_complete
FROM public.produkte p
LEFT JOIN public.bereiche b ON b.id = p.bereich_id
LEFT JOIN public.kategorien k ON k.id = p.kategorie_id
LEFT JOIN public.aktuelle_preise ap ON ap.produkt_id = p.id
LEFT JOIN public.mv_produkt_completeness mv ON mv.produkt_id = p.id;

-- 4. v_dashboard_stats neu (Logik unverändert)
CREATE VIEW public.v_dashboard_stats AS
WITH b_cnt AS (SELECT count(*)::integer AS c FROM public.bereiche),
k_cnt AS (SELECT count(*)::integer AS c FROM public.kategorien),
p_cnt AS (SELECT count(*)::integer AS c FROM public.produkte),
pr_cnt AS (SELECT count(*)::integer AS c FROM public.preise),
i_cnt AS (SELECT count(*)::integer AS c FROM public.icons),
ohne_preis AS (SELECT count(*)::integer AS c FROM public.produkte p WHERE NOT EXISTS (SELECT 1 FROM public.preise pr WHERE pr.produkt_id = p.id)),
ohne_aktiven_preis AS (SELECT count(*)::integer AS c FROM public.produkte p WHERE NOT EXISTS (SELECT 1 FROM public.aktuelle_preise ap WHERE ap.produkt_id = p.id)),
ohne_bild AS (SELECT count(*)::integer AS c FROM public.produkte WHERE hauptbild_path IS NULL),
unbearbeitet AS (SELECT count(*)::integer AS c FROM public.produkte WHERE artikel_bearbeitet = false),
mv_agg AS (
  SELECT COALESCE(round(avg(percent))::integer, 0) AS avg_percent,
    count(*) FILTER (WHERE percent > 80)::integer AS complete_count,
    count(*) FILTER (WHERE percent <= 80)::integer AS needs_attention_count
  FROM public.mv_produkt_completeness
)
SELECT b_cnt.c AS bereiche_count, k_cnt.c AS kategorien_count, p_cnt.c AS produkte_count,
  pr_cnt.c AS preise_count, i_cnt.c AS icons_count, ohne_preis.c AS ohne_preis_count,
  ohne_aktiven_preis.c AS ohne_aktiven_preis_count, ohne_bild.c AS ohne_bild_count,
  unbearbeitet.c AS unbearbeitet_count, mv_agg.avg_percent AS avg_completeness,
  mv_agg.complete_count, mv_agg.needs_attention_count,
  CASE WHEN p_cnt.c = 0 THEN 0
       ELSE round((100.0 * mv_agg.complete_count::numeric) / NULLIF(p_cnt.c, 0)::numeric)::integer
  END AS complete_percent
FROM b_cnt, k_cnt, p_cnt, pr_cnt, i_cnt, ohne_preis, ohne_aktiven_preis, ohne_bild, unbearbeitet, mv_agg;

-- 5. Materialized View direkt befüllen (sonst ist sie leer)
REFRESH MATERIALIZED VIEW public.mv_produkt_completeness;
