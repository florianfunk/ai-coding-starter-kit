-- 0032_katalog_jobs_kunde_typ.sql
-- PROJ-47: katalog_jobs erweitern um Kundenkontext und Job-Typ.
--
-- Neue Spalten:
--   - kunde_id   FK -> kunden(id) ON DELETE SET NULL
--                Markiert Jobs, die aus dem Kunden-Kontext gestartet wurden.
--                Bei Kunden-Loeschung bleibt der Job historisch erhalten.
--   - typ        'katalog' (Default, fuer Bestand) oder 'datenblatt'
--   - produkt_id FK -> produkte(id) ON DELETE SET NULL, nur bei typ='datenblatt' gesetzt.

alter table public.katalog_jobs
  add column if not exists kunde_id   uuid references public.kunden(id)   on delete set null,
  add column if not exists typ        text not null default 'katalog'
                                     check (typ in ('katalog','datenblatt')),
  add column if not exists produkt_id uuid references public.produkte(id) on delete set null;

create index if not exists katalog_jobs_kunde_id  on public.katalog_jobs (kunde_id, created_at desc);
create index if not exists katalog_jobs_typ       on public.katalog_jobs (typ, created_at desc);
