-- 0027_icons_show_as_symbol.sql
-- Fuegt das Flag `show_as_symbol` auf der icons-Tabelle hinzu.
-- Steuert, ob das Icon in den Datenblatt-Quickfact-Kacheln als reines Bild
-- (statt Label/Wert/Unit) gerendert wird.

ALTER TABLE public.icons
  ADD COLUMN IF NOT EXISTS show_as_symbol boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.icons.show_as_symbol IS
  'Wenn true und symbol_path gesetzt: in Datenblatt-Quickfacts wird ausschliesslich das Bild gerendert.';
