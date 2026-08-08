-- =====================================================================
-- PROJ-32: E-Mail-Fristen-Erinnerung (USt-VA-Frist).
--
-- Versand-Log + Idempotenz für die aktive E-Mail-Erinnerung an die
-- USt-VA-Abgabefrist (PROJ-27 liefert die Fristenlogik). Pro Periode UND
-- Stufe (14_tage / 3_tage / ueberfaellig) wird höchstens eine Mail
-- verschickt — sichergestellt durch unique(owner_id, periode_key, stufe).
--
-- Zusätzlich: Opt-in-Flag im Firmenprofil. Default false → der Versand
-- ist standardmäßig AUS und muss explizit aktiviert werden (DSGVO/Konsens).
--
-- RLS owner-scoped wie alle Tabellen. Der Cron-Lauf nutzt den
-- Service-Role-Client (umgeht RLS) und scoped owner_id explizit im Code;
-- die RLS-Policies schützen den regulären (anon/auth) Zugriff der App.
-- =====================================================================

-- 1) Opt-in-Flag (Standard aus → expliziter Opt-in nötig).
alter table firmenprofil
  add column if not exists fristen_mail_aktiv boolean not null default false;

-- 2) Versand-Log / Idempotenz-Tabelle.
create table if not exists fristen_erinnerung (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  -- Stabiler Perioden-Schlüssel "jahr-periode", z. B. "2026-3".
  periode_key  text not null
               check (char_length(periode_key) between 3 and 20),
  -- Erinnerungs-Stufe.
  stufe        text not null
               check (stufe in ('14_tage', '3_tage', 'ueberfaellig')),
  gesendet_am  timestamptz not null default now(),
  -- Idempotenz: pro Owner+Periode+Stufe genau ein Versand.
  unique (owner_id, periode_key, stufe)
);

-- Lookup beim Lauf: alle bereits versendeten Erinnerungen eines Owners.
create index if not exists idx_fristen_erinnerung_owner
  on fristen_erinnerung(owner_id, periode_key);

alter table fristen_erinnerung enable row level security;

create policy "fristen_erinnerung_owner_select"
  on fristen_erinnerung for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "fristen_erinnerung_owner_insert"
  on fristen_erinnerung for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "fristen_erinnerung_owner_update"
  on fristen_erinnerung for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "fristen_erinnerung_owner_delete"
  on fristen_erinnerung for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Seit 2026 werden neue Tabellen je nach Data-API-Einstellung nicht mehr
-- automatisch exponiert. Zugriff explizit nur für angemeldete Nutzer; RLS
-- begrenzt anschließend auf den jeweiligen Owner.
revoke all on table fristen_erinnerung from anon;
grant select, insert, update, delete on table fristen_erinnerung to authenticated;
