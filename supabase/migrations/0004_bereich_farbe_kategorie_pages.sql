-- Bereich: Farbfeld (Hex)
ALTER TABLE public.bereiche ADD COLUMN IF NOT EXISTS farbe text;

-- Bereich: Endseite
ALTER TABLE public.bereiche ADD COLUMN IF NOT EXISTS endseite integer;

-- Kategorien: Seitenangaben
ALTER TABLE public.kategorien ADD COLUMN IF NOT EXISTS seitenzahl integer;
ALTER TABLE public.kategorien ADD COLUMN IF NOT EXISTS startseite integer;
ALTER TABLE public.kategorien ADD COLUMN IF NOT EXISTS endseite integer;
