-- 0028_produkte_achtung_text.sql
-- Trennt den ACHTUNG-/Sicherheitshinweis vom Beschreibungstext.
--
-- Bisher steckte der Warnhinweis (z. B. "UNSACHGEMÄSSE UND LAIENHAFTE
-- VORGEHENSWEISE … ELEKTROFACHKRAFT") in datenblatt_text und wurde im
-- Datenblatt-Generator per Heuristik (splitBeschreibung) heraus-getrennt.
--
-- Wir ziehen das in eine eigene Spalte achtung_text, damit:
--   - der Hinweis im UI als separates Feld gepflegt werden kann,
--   - das PDF ihn zuverlässig (ohne Heuristik) als Warnbox rendert,
--   - die Beschreibung sauber bleibt und für KI-Teaser nutzbar ist.
--
-- Datenmigration: Findet den ersten Marker direkt im Text (case-insensitive)
-- und trennt dort. Marker (in dieser Reihenfolge geprüft):
--   1. "UNSACHGEMÄSSE" / "UNSACHGEMAESSE"
--   2. "LAIENHAFTE VORGEHENSWEISE"
--   3. "ELEKTROFACHKRAFT"
--   4. "ACHTUNG" (am Wortanfang)
--
-- Vor dem Marker stehender Whitespace + reine HTML-Wrapper (z. B. "</p>",
-- "<br>", "\r", "\n") werden vom Body weggeschnitten. Vor allem bei den
-- HTML-Varianten ist das wichtig, sonst stünde z. B. "<p>... Drahtbrücken.</p>"
-- mit hängendem Schluss da.

DROP VIEW IF EXISTS public.v_produkt_listing;

ALTER TABLE public.produkte
  ADD COLUMN IF NOT EXISTS achtung_text text;

COMMENT ON COLUMN public.produkte.achtung_text IS
  'Sicherheits-/Warnhinweis (ACHTUNG-Block). Wird im Datenblatt-PDF als hervorgehobene Warnbox gerendert. Getrennt von datenblatt_text.';

-- Datenmigration ----------------------------------------------------------
-- regexp_match liefert eine character-basierte Capture-Gruppe — anders als
-- position() ist das auch bei UTF-8-Strings (Umlauten) korrekt. Body = m[1],
-- Warnung = ab Marker bis Ende.
WITH matched AS (
  SELECT
    id,
    datenblatt_text,
    regexp_match(
      datenblatt_text,
      '^(.*?)(UNSACHGEMÄSSE|UNSACHGEMAESSE|LAIENHAFTE VORGEHENSWEISE|ELEKTROFACHKRAFT)',
      'is'
    ) AS m
  FROM public.produkte
  WHERE achtung_text IS NULL
    AND datenblatt_text IS NOT NULL
),
extracted AS (
  SELECT
    id,
    -- Body = m[1], abschließenden Whitespace und HTML-Wrapper-Reste wegtrimmen
    regexp_replace(
      m[1],
      '(\s|<p>\s*|<br\s*/?>\s*)+$',
      '',
      'g'
    ) AS new_body,
    -- Warnung = ab Marker (length(m[1]) ist character-count) bis Ende,
    -- vorne hängende HTML-Reste/Whitespace weg.
    regexp_replace(
      substring(datenblatt_text FROM length(m[1]) + 1),
      '^(\s|</p>\s*|<br\s*/?>\s*)+',
      '',
      'g'
    ) AS new_warn
  FROM matched
  WHERE m IS NOT NULL
)
UPDATE public.produkte p
SET
  datenblatt_text = NULLIF(btrim(e.new_body), ''),
  achtung_text    = NULLIF(btrim(e.new_warn), '')
FROM extracted e
WHERE p.id = e.id;

-- v_produkt_listing mit neuer Spalte neu anlegen (1:1 mit 0026 + achtung_text)
CREATE VIEW public.v_produkt_listing AS
SELECT
  p.id,
  p.external_id,
  p.artikelnummer,
  p.bereich_id,
  p.kategorie_id,
  p.name,
  p.sortierung,
  p.artikel_bearbeitet,
  p.hauptbild_path,
  p.datenblatt_titel,
  p.datenblatt_text,
  p.achtung_text,
  p.leistung_w,
  p.nennstrom_a,
  p.nennspannung_v,
  p.schutzklasse,
  p.spannungsart,
  p.gesamteffizienz_lm_w,
  p.lichtstrom_lm,
  p.abstrahlwinkel_grad,
  p.energieeffizienzklasse,
  p.farbtemperatur_k,
  p.farbkonsistenz_sdcm,
  p.farbwiedergabeindex_cri,
  p.led_chip,
  p.lichtverteilung,
  p.ugr,
  p.masse_text,
  p.laenge_mm,
  p.breite_mm,
  p.hoehe_mm,
  p.aussendurchmesser_mm,
  p.einbaudurchmesser_mm,
  p.gewicht_g,
  p.gehaeusefarbe,
  p.montageart,
  p.schlagfestigkeit,
  p.schutzart_ip,
  p.werkstoff_gehaeuse,
  p.leuchtmittel,
  p.sockel,
  p.rollenlaenge_m,
  p.maximale_laenge_m,
  p.anzahl_led_pro_meter,
  p.abstand_led_zu_led_mm,
  p.laenge_abschnitte_mm,
  p.kleinster_biegeradius_mm,
  p.lebensdauer_h,
  p.temperatur_ta,
  p.temperatur_tc,
  p.mit_betriebsgeraet,
  p.optional_text,
  p.zertifikate,
  p.created_at,
  p.updated_at,
  p.created_by,
  p.updated_by,
  p.search_vector,
  p.datenblatt_template_id,
  p.infofeld,
  p.info_kurz,
  p.datenblatt_art,
  p.marker_info,
  p.marker_1,
  p.marker_2,
  p.marker_3,
  p.marker_preis_status,
  p.nicht_leer,
  p.sortierung_fest,
  p.sortierung_alt,
  p.sortierung_ber,
  p.kat_startseite,
  p.bild_detail_1_path,
  p.bild_detail_2_path,
  p.bild_zeichnung_1_path,
  p.bild_zeichnung_2_path,
  p.bild_zeichnung_3_path,
  p.bild_energielabel_path,
  p.marken,
  p.vollstaendig_sections,
  b.name AS bereich_name,
  k.name AS kategorie_name,
  ap.produkt_id IS NOT NULL AS hat_preis,
  ((SELECT count(*) FROM produkt_icons pi WHERE pi.produkt_id = p.id))::integer AS icon_count,
  ((SELECT count(*) FROM produkt_bilder pb WHERE pb.produkt_id = p.id))::integer AS galerie_count,
  COALESCE(mv.percent, 0) AS completeness_percent,
  COALESCE(mv.is_complete, false) AS completeness_complete
FROM produkte p
LEFT JOIN kategorien k ON k.id = p.kategorie_id
LEFT JOIN bereiche b ON b.id = k.bereich_id
LEFT JOIN aktuelle_preise_flat ap ON ap.produkt_id = p.id
LEFT JOIN mv_produkt_completeness mv ON mv.produkt_id = p.id;
