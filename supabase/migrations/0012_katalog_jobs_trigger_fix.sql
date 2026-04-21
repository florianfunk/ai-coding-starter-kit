-- ============================================================================
-- Fix: katalog_jobs-Trigger crasht, weil set_updated_at() new.updated_by setzt,
-- die Tabelle aber keine updated_by-Spalte hat. Jedes UPDATE schlug fehl mit
-- "record \"new\" has no field \"updated_by\"", wodurch der Render-Job-Claim
-- 0 Zeilen zurückgab und Jobs dauerhaft auf status='queued', progress=0 hingen.
-- Lösung: dedizierter Trigger, der nur updated_at setzt.
-- ============================================================================

drop trigger if exists katalog_jobs_set_updated on public.katalog_jobs;

create or replace function public.set_updated_at_only()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger katalog_jobs_set_updated
  before update on public.katalog_jobs
  for each row execute function public.set_updated_at_only();
