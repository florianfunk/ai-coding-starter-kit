-- 0031_kunden.sql
-- PROJ-47: Kundendatenbank
--
-- Vier neue Tabellen:
--   - kunden            (Stammdaten + Preis-Konfig + Auswahl-Modus)
--   - kunden_branchen   (Tag-Pool)
--   - kunde_branche     (M:N Junction Kunde <-> Branche)
--   - kunde_produkt     (M:N Whitelist Kunde <-> Produkt; ignoriert wenn alle_produkte=true)
--
-- RLS analog zu allen anderen Tabellen: alle authentifizierten Nutzer
-- duerfen alles (single-role-Modell laut PRD).

create table public.kunden (
  id                      uuid primary key default gen_random_uuid(),
  kunden_nr               text not null unique,
  firma                   text not null,
  ansprechpartner         text,
  email                   text,
  telefon                 text,
  website                 text,
  strasse                 text,
  plz                     text,
  ort                     text,
  land                    text default 'Deutschland',
  standard_filiale        text check (standard_filiale in ('lichtengros','eisenkeil')),
  preis_spur              text not null default 'listenpreis'
                          check (preis_spur in ('lichtengros','eisenkeil','listenpreis')),
  aufschlag_vorzeichen    text not null default 'plus'
                          check (aufschlag_vorzeichen in ('plus','minus')),
  aufschlag_pct           numeric(5,2) not null default 0
                          check (aufschlag_pct >= 0 and aufschlag_pct <= 100),
  alle_produkte           boolean not null default false,
  notizen                 text,
  status                  text not null default 'aktiv'
                          check (status in ('aktiv','archiviert')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references auth.users(id),
  updated_by              uuid references auth.users(id)
);

create index kunden_firma_pattern on public.kunden (firma text_pattern_ops);
create index kunden_status        on public.kunden (status);
create index kunden_updated_at    on public.kunden (updated_at desc);

create trigger kunden_set_created before insert on public.kunden
  for each row execute function public.set_created_by();
create trigger kunden_set_updated before update on public.kunden
  for each row execute function public.set_updated_at();

create table public.kunden_branchen (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create trigger kunden_branchen_set_created before insert on public.kunden_branchen
  for each row execute function public.set_created_by();

create table public.kunde_branche (
  kunde_id    uuid not null references public.kunden(id)         on delete cascade,
  branche_id  uuid not null references public.kunden_branchen(id) on delete cascade,
  primary key (kunde_id, branche_id)
);
create index kunde_branche_branche on public.kunde_branche (branche_id);

create table public.kunde_produkt (
  kunde_id    uuid not null references public.kunden(id)   on delete cascade,
  produkt_id  uuid not null references public.produkte(id) on delete cascade,
  primary key (kunde_id, produkt_id)
);
create index kunde_produkt_produkt on public.kunde_produkt (produkt_id);

-- ----------------------------------------------------------------------------
-- RLS: alle authentifizierten Nutzer haben vollen CRUD-Zugriff
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'kunden','kunden_branchen','kunde_branche','kunde_produkt'
  ]) loop
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
