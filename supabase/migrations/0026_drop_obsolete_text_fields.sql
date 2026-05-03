-- Entfernt nicht mehr benötigte Textfelder aus produkte:
-- - datenblatt_text_2, datenblatt_text_3 (UI auf einen Block reduziert)
-- - treiber                              (Feld aus Formular entfernt)
-- - bild_detail_1_text/2_text/3_text     (Detail-Texte entfernt)
ALTER TABLE public.produkte
  DROP COLUMN IF EXISTS datenblatt_text_2,
  DROP COLUMN IF EXISTS datenblatt_text_3,
  DROP COLUMN IF EXISTS treiber,
  DROP COLUMN IF EXISTS bild_detail_1_text,
  DROP COLUMN IF EXISTS bild_detail_2_text,
  DROP COLUMN IF EXISTS bild_detail_3_text;
