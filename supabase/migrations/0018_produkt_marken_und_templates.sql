-- PROJ-36: Marken pro Produkt + Seed der 3 FileMaker-Datenblatt-Vorlagen
--
-- 1. Spalte `marken` (Array des bestehenden ENUM marke) auf produkte
--    - Default: {lichtengros} für Bestandsprodukte
--    - CHECK: mindestens ein Eintrag
--
-- 2. 3 System-Vorlagen V1/V2/V3 idempotent anlegen
--    (slots bleibt leer — Slot-Geometrie kommt in PROJ-9)

-- 1. produkte.marken --------------------------------------------------------

ALTER TABLE public.produkte
  ADD COLUMN IF NOT EXISTS marken marke[] NOT NULL DEFAULT ARRAY['lichtengros']::marke[];

-- Mindestens eine Marke muss gesetzt sein
ALTER TABLE public.produkte
  DROP CONSTRAINT IF EXISTS produkte_marken_not_empty;
ALTER TABLE public.produkte
  ADD CONSTRAINT produkte_marken_not_empty
  CHECK (array_length(marken, 1) >= 1);

-- Index für Filterung nach Marke (GIN für Array-Membership)
CREATE INDEX IF NOT EXISTS produkte_marken_idx ON public.produkte USING gin (marken);

COMMENT ON COLUMN public.produkte.marken IS
  'PROJ-36: Marken-Zuordnung (Mehrfachauswahl). Steuert, in welchem Marken-Katalog das Produkt erscheint.';

-- 2. Datenblatt-Vorlagen V1/V2/V3 idempotent seeden -------------------------

INSERT INTO public.datenblatt_templates (id, name, beschreibung, is_system, page_width_cm, page_height_cm, slots, sortierung)
VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'V1 — Leuchte / Spot',
    'Standard-Layout für Einbauleuchten, Spots und fertige Leuchten. 2 Detail-Bilder + 3 technische Zeichnungen.',
    true, 21.0, 29.7, '[]'::jsonb, 10
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'V2 — LED-Flexband / Strip',
    'Layout für LED-Streifen. Hauptbild mit Maßskizze, 2 Detail-Bilder + 1 große Anwendungs-Zeichnung.',
    true, 21.0, 29.7, '[]'::jsonb, 20
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'V3 — Neon Flex',
    'Layout für Neon-Strips mit TIPS-Sektion. Hauptbild mit Zeichnung_2, 2 Detail-Bilder + 1 Zeichnung.',
    true, 21.0, 29.7, '[]'::jsonb, 30
  )
ON CONFLICT (id) DO NOTHING;
