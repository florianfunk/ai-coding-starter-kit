-- Datenblatt-Templates: each template has a page size (A4) and a set of slots.
-- Slots stored as JSONB array: [{ id, label, x_cm, y_cm, width_cm, height_cm, kind }]
-- kind ∈ 'image' | 'energielabel' | 'cutting' (semantic hint; rendering same)

CREATE TABLE IF NOT EXISTS public.datenblatt_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  beschreibung text,
  is_system   boolean NOT NULL DEFAULT false,
  page_width_cm  numeric(5,2) NOT NULL DEFAULT 21.0,
  page_height_cm numeric(5,2) NOT NULL DEFAULT 29.7,
  slots       jsonb NOT NULL DEFAULT '[]'::jsonb,
  sortierung  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id),
  updated_by  uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS datenblatt_templates_sortierung_idx ON public.datenblatt_templates (sortierung);

CREATE TRIGGER datenblatt_templates_set_created BEFORE INSERT ON public.datenblatt_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
CREATE TRIGGER datenblatt_templates_set_updated BEFORE UPDATE ON public.datenblatt_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Produkt-to-Slot bildzuordnung
CREATE TABLE IF NOT EXISTS public.produkt_datenblatt_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produkt_id   uuid NOT NULL REFERENCES public.produkte(id) ON DELETE CASCADE,
  template_id  uuid NOT NULL REFERENCES public.datenblatt_templates(id) ON DELETE CASCADE,
  slot_id      text NOT NULL,             -- matches slot.id within template
  storage_path text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(produkt_id, template_id, slot_id)
);
CREATE INDEX IF NOT EXISTS produkt_datenblatt_slots_produkt_idx ON public.produkt_datenblatt_slots (produkt_id, template_id);

-- Active template per product
ALTER TABLE public.produkte
  ADD COLUMN IF NOT EXISTS datenblatt_template_id uuid REFERENCES public.datenblatt_templates(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.datenblatt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produkt_datenblatt_slots ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['datenblatt_templates', 'produkt_datenblatt_slots']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_delete" ON public.%I', t);
    EXECUTE format('CREATE POLICY "auth_select" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "auth_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "auth_update" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "auth_delete" ON public.%I FOR DELETE TO authenticated USING (true)', t);
  END LOOP;
END $$;
