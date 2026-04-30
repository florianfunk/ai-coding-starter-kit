-- PROJ-38: Datenblatt-Vorlagen mit LaTeX-Layout-Varianten
--
-- 1. Schema-Erweiterung von datenblatt_templates:
--    - latex_template_key: verknuepft Vorlage mit konkretem LaTeX-Template-Ordner
--    - is_default:         genau eine Default-Vorlage (per Partial-Index erzwungen)
--    - preview_image_path: Pfad zum statischen Vorschau-PNG unter /public
--
-- 2. Seed der Modern-Vorlage als erste aktivierte Vorlage (Default)
--
-- 3. Backfill: Alle Produkte ohne Vorlage bekommen die neue Default-Vorlage
--
-- Idempotent: kann mehrfach laufen, ohne Daten zu verfaelschen.

-- 1. Schema-Erweiterung -----------------------------------------------------

ALTER TABLE public.datenblatt_templates
  ADD COLUMN IF NOT EXISTS latex_template_key text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preview_image_path text;

COMMENT ON COLUMN public.datenblatt_templates.latex_template_key IS
  'PROJ-38: Verweist auf den LaTeX-Template-Ordner unter services/latex-pdf-service/templates/. NULL = Vorlage existiert, ist aber nicht aktiviert (Skeleton).';
COMMENT ON COLUMN public.datenblatt_templates.is_default IS
  'PROJ-38: Genau eine Vorlage ist Default; Produkte ohne Vorlagen-Zuordnung rendern damit. Per Partial-Index erzwungen.';
COMMENT ON COLUMN public.datenblatt_templates.preview_image_path IS
  'PROJ-38: Pfad zum eingecheckten Vorschau-PNG unter /public (z.B. /datenblatt-vorlagen/preview-modern.png).';

-- Maximal eine Default-Vorlage (Partial-Index = Constraint mit Filter)
DROP INDEX IF EXISTS datenblatt_templates_one_default_idx;
CREATE UNIQUE INDEX datenblatt_templates_one_default_idx
  ON public.datenblatt_templates ((1)) WHERE is_default = true;

-- Schnellzugriff auf aktivierte Vorlagen
CREATE INDEX IF NOT EXISTS datenblatt_templates_active_idx
  ON public.datenblatt_templates (latex_template_key)
  WHERE latex_template_key IS NOT NULL;

-- 2. Modern-Vorlage seeden --------------------------------------------------
--
-- Slots-Struktur (PROJ-38):
--   {
--     id:         stabil (slug-style),
--     kind:       'image' | 'energielabel' | 'cutting',
--     label:      UI-Anzeige,
--     position:   semantischer Platzhalter ('hero', 'detail-1', 'detail-2', 'energy-override', 'cutting-1'),
--     x_cm,y_cm,width_cm,height_cm: nur fuer UI-Preview (LaTeX-Template hat eigene Positionen),
--     optional:   true = darf leer sein, false = soll gefuellt sein
--   }
--
-- Position-Werte sind der Schluessel fuer den Vorlagen-Wechsel: Slot-Bilder werden
-- nach kind+position gemappt, nicht nach UUID.

INSERT INTO public.datenblatt_templates
  (id, name, beschreibung, is_system, is_default, latex_template_key, preview_image_path,
   page_width_cm, page_height_cm, slots, sortierung)
VALUES
  (
    'b1000000-0000-0000-0000-000000000001',
    'Modern Lichtengross',
    'Aktuelles modernes Layout mit Hero-Bild, 2 Detail-Bildern, Energielabel-Override und Cutting-Diagramm.',
    true, true, 'lichtengross-datenblatt-modern',
    '/datenblatt-vorlagen/preview-lichtengross-datenblatt-modern.png',
    21.0, 29.7,
    jsonb_build_array(
      jsonb_build_object(
        'id', 'modern-hero',
        'kind', 'image',
        'label', 'Hauptbild',
        'position', 'hero',
        'x_cm', 1.5, 'y_cm', 9.5,
        'width_cm', 8.0, 'height_cm', 2.4,
        'optional', false
      ),
      jsonb_build_object(
        'id', 'modern-detail-1',
        'kind', 'image',
        'label', 'Detail 1',
        'position', 'detail-1',
        'x_cm', 9.7, 'y_cm', 9.5,
        'width_cm', 4.7, 'height_cm', 2.4,
        'optional', true
      ),
      jsonb_build_object(
        'id', 'modern-detail-2',
        'kind', 'image',
        'label', 'Detail 2',
        'position', 'detail-2',
        'x_cm', 14.6, 'y_cm', 9.5,
        'width_cm', 4.7, 'height_cm', 2.4,
        'optional', true
      ),
      jsonb_build_object(
        'id', 'modern-energy',
        'kind', 'energielabel',
        'label', 'Energielabel-Override',
        'position', 'energy-override',
        'x_cm', 17.0, 'y_cm', 4.5,
        'width_cm', 1.5, 'height_cm', 3.0,
        'optional', true
      ),
      jsonb_build_object(
        'id', 'modern-cutting',
        'kind', 'cutting',
        'label', 'Cutting-Diagramm',
        'position', 'cutting-1',
        'x_cm', 1.5, 'y_cm', 12.5,
        'width_cm', 11.0, 'height_cm', 2.2,
        'optional', true
      )
    ),
    1
  )
ON CONFLICT (id) DO UPDATE SET
  -- Updaten wir bei Re-Run, falls Slot-Definition oder Metadata sich aendern
  latex_template_key = EXCLUDED.latex_template_key,
  preview_image_path = EXCLUDED.preview_image_path,
  is_default         = EXCLUDED.is_default,
  is_system          = EXCLUDED.is_system,
  beschreibung       = EXCLUDED.beschreibung,
  page_width_cm      = EXCLUDED.page_width_cm,
  page_height_cm     = EXCLUDED.page_height_cm,
  slots              = EXCLUDED.slots;

-- Sicherstellen, dass keine andere Vorlage versehentlich is_default hat
UPDATE public.datenblatt_templates
   SET is_default = false
 WHERE id <> 'b1000000-0000-0000-0000-000000000001'
   AND is_default = true;

-- 3. Backfill: Produkte ohne Vorlage bekommen Default ----------------------

UPDATE public.produkte
   SET datenblatt_template_id = 'b1000000-0000-0000-0000-000000000001'
 WHERE datenblatt_template_id IS NULL;

-- Bestehende Zuordnungen auf Skeleton-Vorlagen (latex_template_key IS NULL)
-- ebenfalls auf Modern umlenken, damit der Datenblatt-Button fuer alle Produkte
-- ein renderbares Layout findet.
UPDATE public.produkte
   SET datenblatt_template_id = 'b1000000-0000-0000-0000-000000000001'
 WHERE datenblatt_template_id IN (
   SELECT id FROM public.datenblatt_templates WHERE latex_template_key IS NULL
 );
