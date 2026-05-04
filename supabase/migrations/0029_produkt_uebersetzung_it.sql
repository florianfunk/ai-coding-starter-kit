-- 0029_produkt_uebersetzung_it.sql
-- PROJ-46: Italienische Übersetzung für Datenblätter.
--
-- Spiegel-Spalten *_it für die zehn datenblatt-relevanten Textfelder. Alle
-- nullable, kein Default — leere Spalte = "noch nicht übersetzt". Im PDF
-- fällt der Renderer für leere Felder auf die deutsche Variante zurück.
--
-- Bestehende RLS-Policies auf `produkte` decken die neuen Spalten automatisch
-- ab — Spalten erben Tabellen-RLS, kein Policy-Update nötig.

ALTER TABLE public.produkte
  ADD COLUMN IF NOT EXISTS name_it                text,
  ADD COLUMN IF NOT EXISTS datenblatt_titel_it    text,
  ADD COLUMN IF NOT EXISTS info_kurz_it           text,
  ADD COLUMN IF NOT EXISTS treiber_it             text,
  ADD COLUMN IF NOT EXISTS datenblatt_text_it     text,
  ADD COLUMN IF NOT EXISTS achtung_text_it        text,
  ADD COLUMN IF NOT EXISTS bild_detail_1_text_it  text,
  ADD COLUMN IF NOT EXISTS bild_detail_2_text_it  text,
  ADD COLUMN IF NOT EXISTS bild_detail_3_text_it  text;

COMMENT ON COLUMN public.produkte.name_it IS
  'Italienische Übersetzung von name. PROJ-46.';
COMMENT ON COLUMN public.produkte.datenblatt_titel_it IS
  'Italienische Übersetzung von datenblatt_titel. PROJ-46.';
COMMENT ON COLUMN public.produkte.info_kurz_it IS
  'Italienische Übersetzung von info_kurz. PROJ-46.';
COMMENT ON COLUMN public.produkte.treiber_it IS
  'Italienische Übersetzung von treiber. PROJ-46.';
COMMENT ON COLUMN public.produkte.datenblatt_text_it IS
  'Italienische Übersetzung von datenblatt_text (Rich-HTML). PROJ-46.';
COMMENT ON COLUMN public.produkte.achtung_text_it IS
  'Italienische Übersetzung von achtung_text (Rich-HTML). PROJ-46.';
COMMENT ON COLUMN public.produkte.bild_detail_1_text_it IS
  'Italienische Übersetzung von bild_detail_1_text. PROJ-46.';
COMMENT ON COLUMN public.produkte.bild_detail_2_text_it IS
  'Italienische Übersetzung von bild_detail_2_text. PROJ-46.';
COMMENT ON COLUMN public.produkte.bild_detail_3_text_it IS
  'Italienische Übersetzung von bild_detail_3_text. PROJ-46.';
