-- ============================================================================
-- Lichtstudio: Initial Schema
-- ============================================================================
-- Bereiche -> Kategorien -> Produkte -> Preise / Bilder / Icons
-- Filialen, Katalog-Einstellungen (Singleton), Katalog-Jobs
-- RLS: alle Tabellen, nur authentifizierte Nutzer haben Zugriff (Single Role)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create or replace function public.set_created_by()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is null then new.created_by = auth.uid(); end if;
  if new.updated_by is null then new.updated_by = auth.uid(); end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- bereiche
-- ----------------------------------------------------------------------------
create table public.bereiche (
  id              uuid primary key default gen_random_uuid(),
  external_id     text unique,                 -- FileMaker UUID
  name            text not null,
  beschreibung    text,
  sortierung      integer not null default 0,
  seitenzahl      integer,
  startseite      integer,
  bild_path       text,                        -- Storage path im bucket "produktbilder"
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id)
);
create index on public.bereiche (sortierung);

create trigger bereiche_set_created  before insert on public.bereiche for each row execute function public.set_created_by();
create trigger bereiche_set_updated  before update on public.bereiche for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- icons (Referenzliste)
-- ----------------------------------------------------------------------------
create table public.icons (
  id              uuid primary key default gen_random_uuid(),
  external_id     text unique,
  label           text not null unique,        -- z.B. "2700K", "IP20", "Dimmable"
  symbol_path     text,                        -- Storage path
  sortierung      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- kategorien
-- ----------------------------------------------------------------------------
create table public.kategorien (
  id              uuid primary key default gen_random_uuid(),
  external_id     text unique,
  bereich_id      uuid not null references public.bereiche(id) on delete restrict,
  name            text not null,
  beschreibung    text,
  sortierung      integer not null default 0,
  vorschaubild_path text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id)
);
create index on public.kategorien (bereich_id);
create index on public.kategorien (sortierung);

create trigger kategorien_set_created before insert on public.kategorien for each row execute function public.set_created_by();
create trigger kategorien_set_updated before update on public.kategorien for each row execute function public.set_updated_at();

create table public.kategorie_icons (
  kategorie_id uuid not null references public.kategorien(id) on delete cascade,
  icon_id      uuid not null references public.icons(id)      on delete cascade,
  primary key (kategorie_id, icon_id)
);

-- ----------------------------------------------------------------------------
-- produkte (flach: alle technischen Felder als Spalten)
-- ----------------------------------------------------------------------------
create table public.produkte (
  id                          uuid primary key default gen_random_uuid(),
  external_id                 text unique,
  artikelnummer               text not null unique,
  bereich_id                  uuid not null references public.bereiche(id)   on delete restrict,
  kategorie_id                uuid not null references public.kategorien(id) on delete restrict,
  name                        text,
  sortierung                  integer not null default 0,
  artikel_bearbeitet          boolean not null default false,
  hauptbild_path              text,

  -- Datenblatt
  datenblatt_titel            text,
  datenblatt_text             text,    -- Markdown

  -- Elektrotechnisch
  leistung_w                  numeric,
  nennstrom_a                 numeric,
  nennspannung_v              numeric,
  schutzklasse                text,
  spannungsart                text,
  gesamteffizienz_lm_w        numeric,

  -- Lichttechnisch
  lichtstrom_lm               numeric,
  abstrahlwinkel_grad         numeric,
  energieeffizienzklasse      text,
  farbtemperatur_k            numeric,
  farbkonsistenz_sdcm         text,
  farbwiedergabeindex_cri     numeric,
  led_chip                    text,
  lichtverteilung             text,
  ugr                         text,

  -- Mechanisch
  masse_text                  text,    -- z.B. "5000x2,1mm"
  laenge_mm                   numeric,
  breite_mm                   numeric,
  hoehe_mm                    numeric,
  aussendurchmesser_mm        numeric,
  einbaudurchmesser_mm        numeric,
  gewicht_g                   numeric,
  gehaeusefarbe               text,
  montageart                  text,
  schlagfestigkeit            text,
  schutzart_ip                text,
  werkstoff_gehaeuse          text,
  leuchtmittel                text,
  sockel                      text,
  rollenlaenge_m              numeric,
  maximale_laenge_m           numeric,
  anzahl_led_pro_meter        numeric,
  abstand_led_zu_led_mm       numeric,
  laenge_abschnitte_mm        numeric,
  kleinster_biegeradius_mm    numeric,

  -- Thermisch
  lebensdauer_h               numeric,
  temperatur_ta               text,    -- z.B. "-25~40°C"
  temperatur_tc               text,

  -- Sonstiges
  mit_betriebsgeraet          boolean,
  optional_text               text,
  zertifikate                 text,    -- z.B. "CE, RoHS"

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  created_by                  uuid references auth.users(id),
  updated_by                  uuid references auth.users(id)
);
create index on public.produkte (kategorie_id);
create index on public.produkte (bereich_id);
create index on public.produkte (artikelnummer);
create index on public.produkte (artikel_bearbeitet);
create index on public.produkte (sortierung);

create trigger produkte_set_created before insert on public.produkte for each row execute function public.set_created_by();
create trigger produkte_set_updated before update on public.produkte for each row execute function public.set_updated_at();

-- Full-Text-Search Spalte (deutsch) für PROJ-7
alter table public.produkte
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('german', coalesce(artikelnummer, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(name, '')), 'B') ||
    setweight(to_tsvector('german', coalesce(datenblatt_titel, '')), 'C') ||
    setweight(to_tsvector('german', coalesce(datenblatt_text, '')), 'D')
  ) stored;

create index produkte_search_idx on public.produkte using gin (search_vector);

-- ----------------------------------------------------------------------------
-- produkt_bilder (Galerie)
-- ----------------------------------------------------------------------------
create table public.produkt_bilder (
  id           uuid primary key default gen_random_uuid(),
  produkt_id   uuid not null references public.produkte(id) on delete cascade,
  storage_path text not null,
  alt_text     text,
  sortierung   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index on public.produkt_bilder (produkt_id, sortierung);

-- ----------------------------------------------------------------------------
-- produkt_icons (Icon-Leiste oben im Datenblatt)
-- ----------------------------------------------------------------------------
create table public.produkt_icons (
  produkt_id uuid not null references public.produkte(id) on delete cascade,
  icon_id    uuid not null references public.icons(id)    on delete cascade,
  sortierung integer not null default 0,
  primary key (produkt_id, icon_id)
);

-- ----------------------------------------------------------------------------
-- preise
-- ----------------------------------------------------------------------------
create type preis_status as enum ('aktiv', 'inaktiv');

create table public.preise (
  id           uuid primary key default gen_random_uuid(),
  produkt_id   uuid not null references public.produkte(id) on delete cascade,
  gueltig_ab   date not null default current_date,
  ek           numeric(10,2),
  listenpreis  numeric(10,2) not null,
  status       preis_status not null default 'aktiv',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  updated_by   uuid references auth.users(id)
);
create index on public.preise (produkt_id, gueltig_ab desc);
create index on public.preise (status);

create trigger preise_set_created before insert on public.preise for each row execute function public.set_created_by();
create trigger preise_set_updated before update on public.preise for each row execute function public.set_updated_at();

-- View: aktueller Preis pro Produkt
create or replace view public.aktuelle_preise as
select distinct on (produkt_id)
  produkt_id, id as preis_id, gueltig_ab, listenpreis, ek, status
from public.preise
where status = 'aktiv' and gueltig_ab <= current_date
order by produkt_id, gueltig_ab desc, created_at desc;

-- ----------------------------------------------------------------------------
-- filialen
-- ----------------------------------------------------------------------------
create type marke as enum ('lichtengros', 'eisenkeil');

create table public.filialen (
  id          uuid primary key default gen_random_uuid(),
  external_id text unique,
  marke       marke not null,
  name        text not null,
  land        text,
  adresse     text,
  telefon     text,
  fax         text,
  email       text,
  sortierung  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id)
);
create index on public.filialen (marke, sortierung);

create trigger filialen_set_created before insert on public.filialen for each row execute function public.set_created_by();
create trigger filialen_set_updated before update on public.filialen for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- katalog_einstellungen (Singleton)
-- ----------------------------------------------------------------------------
create table public.katalog_einstellungen (
  id                          integer primary key default 1 check (id = 1),
  copyright_lichtengros       text,
  copyright_eisenkeil         text,
  gueltig_bis                 date,
  cover_vorne_path            text,
  cover_hinten_path           text,
  logo_lichtengros_dunkel     text,
  logo_lichtengros_hell       text,
  logo_eisenkeil_dunkel       text,
  logo_eisenkeil_hell         text,
  logo_lichtstudio            text,
  wechselkurs_eur_chf         numeric(10,4) default 1.0,
  updated_at                  timestamptz not null default now(),
  updated_by                  uuid references auth.users(id)
);

create trigger katalog_einstellungen_set_updated before update on public.katalog_einstellungen for each row execute function public.set_updated_at();
insert into public.katalog_einstellungen (id) values (1) on conflict do nothing;

-- ----------------------------------------------------------------------------
-- katalog_jobs (für PROJ-10 Background-PDF)
-- ----------------------------------------------------------------------------
create type job_status as enum ('queued', 'running', 'done', 'error');

create table public.katalog_jobs (
  id          uuid primary key default gen_random_uuid(),
  status      job_status not null default 'queued',
  parameter   jsonb not null default '{}'::jsonb,
  progress    integer not null default 0,
  pdf_path    text,
  error_text  text,
  started_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.katalog_jobs (status, created_at desc);

create trigger katalog_jobs_set_updated before update on public.katalog_jobs for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY — alle Tabellen, eine Rolle (eingeloggt)
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'bereiche','icons','kategorien','kategorie_icons',
    'produkte','produkt_bilder','produkt_icons',
    'preise','filialen','katalog_einstellungen','katalog_jobs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "auth_select" on public.%I', t);
    execute format('drop policy if exists "auth_insert" on public.%I', t);
    execute format('drop policy if exists "auth_update" on public.%I', t);
    execute format('drop policy if exists "auth_delete" on public.%I', t);
    execute format('create policy "auth_select" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "auth_insert" on public.%I for insert to authenticated with check (true)', t);
    execute format('create policy "auth_update" on public.%I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "auth_delete" on public.%I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- aktuelle_preise als View — RLS erbt von Basistabelle (preise)
grant select on public.aktuelle_preise to authenticated;
