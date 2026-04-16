-- Add 3 datasheet text blocks (replacing single datenblatt_text)
ALTER TABLE public.produkte ADD COLUMN IF NOT EXISTS datenblatt_text_2 text;
ALTER TABLE public.produkte ADD COLUMN IF NOT EXISTS datenblatt_text_3 text;

-- Add EK Eisenkeil to preise
ALTER TABLE public.preise ADD COLUMN IF NOT EXISTS ek_eisenkeil numeric(10,2);

-- Update aktuelle_preise view to include ek_eisenkeil
DROP VIEW IF EXISTS public.aktuelle_preise;
CREATE VIEW public.aktuelle_preise AS
SELECT DISTINCT ON (produkt_id)
  produkt_id, id AS preis_id, gueltig_ab, listenpreis, ek, ek_eisenkeil, status
FROM public.preise
WHERE status = 'aktiv' AND gueltig_ab <= current_date
ORDER BY produkt_id, gueltig_ab DESC, created_at DESC;

GRANT SELECT ON public.aktuelle_preise TO authenticated;
