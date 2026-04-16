-- Icons: add "gruppe" (category of the icon, e.g. Lichtfarbe, Zertifikate)
ALTER TABLE public.icons ADD COLUMN IF NOT EXISTS gruppe text;

-- Unique label+gruppe so same label in different groups is allowed
-- Drop old unique constraint on label if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'icons_label_key'
  ) THEN
    ALTER TABLE public.icons DROP CONSTRAINT icons_label_key;
  END IF;
END $$;

-- Index for fast group filtering
CREATE INDEX IF NOT EXISTS icons_gruppe_idx ON public.icons (gruppe, sortierung);

-- Ensure bucket for icon images exists (re-use produktbilder bucket under "icons/" folder)
-- Already available via existing RLS policies.
