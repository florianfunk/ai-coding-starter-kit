-- PROJ-35: Kategorie mit 4 Bildplatzhaltern statt einem Vorschaubild.
--
-- FileMaker-Vorlage: pro Kategorie-Seite gibt es 4 Bilder
--   Bild1 (15×3 cm, breit mittig)
--   Bild2 (15×3 cm, breit unten)
--   Bild3 (5×3 cm, hochkant rechts oben)
--   Bild4 (5×3 cm, rechts unten)
--
-- Idempotent: funktioniert sowohl auf frischen DBs (mit `vorschaubild_path`)
-- als auch auf DBs, die bereits manuell migriert wurden.

alter table public.kategorien
  add column if not exists bild1_path text,
  add column if not exists bild2_path text,
  add column if not exists bild3_path text,
  add column if not exists bild4_path text;

-- Backfill nur, wenn die Alt-Spalte noch existiert
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'kategorien'
       and column_name  = 'vorschaubild_path'
  ) then
    update public.kategorien
       set bild1_path = vorschaubild_path
     where bild1_path is null
       and vorschaubild_path is not null;

    alter table public.kategorien drop column vorschaubild_path;
  end if;
end $$;
