-- PROJ-16 — Mein Profil: persoenliche Stammdaten als LLM-Kontext.
--
-- Drei neue Tabellen, alle owner-scoped, RLS aktiviert, Trigger fuer
-- updated_at (set_updated_at() existiert seit 0001).
--
-- Datenmodell:
--   - mein_profil_arbeitgeber   : Liste pro Owner (Job-Wechsel via aktiv_von/bis)
--   - mein_profil_familie       : Liste pro Owner mit Rolle + Geschaeftspartner-Flag
--   - mein_profil_adresse       : Single-Row pro Owner (owner_id ist PK)
--
-- `name_normalisiert` wird in der App-Schicht via
-- `normalisiereEmpfaenger(name)` aus `src/lib/classifier/normalize.ts`
-- gesetzt (gleiche Logik wie buchung.empfaenger_normalisiert in 0003).
-- Damit greift der Family-Match exakt gegen normalisierte Empfaenger-
-- Schluessel — wir muessen NICHT zur Laufzeit normalisieren.

-- ---------------------------------------------------------------------------
-- Arbeitgeber
-- ---------------------------------------------------------------------------
create table mein_profil_arbeitgeber (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  name_normalisiert  text not null,
  aktiv_von          date,
  aktiv_bis          date,
  notiz              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_mein_profil_arbeitgeber_updated
  before update on mein_profil_arbeitgeber
  for each row execute function set_updated_at();

create index idx_mein_profil_arbeitgeber_owner_norm
  on mein_profil_arbeitgeber(owner_id, name_normalisiert);

-- ---------------------------------------------------------------------------
-- Familienmitglieder
-- ---------------------------------------------------------------------------
create table mein_profil_familie (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null references auth.users(id) on delete cascade,
  name                     text not null,
  name_normalisiert        text not null,
  rolle                    text not null
    check (rolle in ('ehepartner','kind','eltern','sonstige')),
  auch_geschaeftspartner   boolean not null default false,
  notiz                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger trg_mein_profil_familie_updated
  before update on mein_profil_familie
  for each row execute function set_updated_at();

create index idx_mein_profil_familie_owner_norm
  on mein_profil_familie(owner_id, name_normalisiert);

-- ---------------------------------------------------------------------------
-- Adresse (Single-Row pro Owner)
-- ---------------------------------------------------------------------------
create table mein_profil_adresse (
  owner_id    uuid primary key references auth.users(id) on delete cascade,
  strasse     text,
  plz         text,
  ort         text,
  land        text not null default 'DE',
  updated_at  timestamptz not null default now()
);

create trigger trg_mein_profil_adresse_updated
  before update on mein_profil_adresse
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table mein_profil_arbeitgeber enable row level security;
create policy mein_profil_arbeitgeber_owner on mein_profil_arbeitgeber
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table mein_profil_familie enable row level security;
create policy mein_profil_familie_owner on mein_profil_familie
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table mein_profil_adresse enable row level security;
create policy mein_profil_adresse_owner on mein_profil_adresse
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
