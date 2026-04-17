-- ============================================================================
-- PROJ-2: Zusätzliche Felder für FileMaker-Data-API-Import
-- ============================================================================
-- Neue Spalten in `produkte` für:
--   • Marker-Felder (artikel_bearbeitet existiert bereits)
--   • Sortierfelder (Katalog)
--   • Datenblatt-Variante + Zusatzinfos
--   • Bildunterschriften
--   • Weitere technische Felder (Infofeld, Treiber)
-- Neue Spalten in `bereiche` / `kategorien` für Audit-Metadaten aus FileMaker.
-- Neue Tabelle `produkt_bild_slots` für die festen Bild-Positionen im Datenblatt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- produkte: Marker, Sortierung, Datenblatt-Meta, Bildtexte, Zusatzfelder
-- ---------------------------------------------------------------------------
alter table public.produkte
  add column if not exists infofeld             text,         -- "Infofeld"
  add column if not exists info_kurz            text,         -- "t__Info" (Kurzbeschreibung)
  add column if not exists treiber              text,         -- "w_Treiber"
  add column if not exists datenblatt_art       text,         -- "Datenblatt_art" (V1/V2/V3 Template-Wahl)
  add column if not exists marker_info          boolean not null default false,
  add column if not exists marker_1             boolean not null default false,
  add column if not exists marker_2             boolean not null default false,
  add column if not exists marker_3             boolean not null default false,
  add column if not exists marker_preis_status  boolean not null default false,
  add column if not exists nicht_leer           boolean not null default false,
  add column if not exists sortierung_fest      integer,
  add column if not exists sortierung_alt       integer,
  add column if not exists sortierung_ber       integer,
  add column if not exists kat_startseite       integer,
  add column if not exists bild_detail_1_text   text,
  add column if not exists bild_detail_2_text   text,
  add column if not exists bild_detail_3_text   text,
  add column if not exists bild_detail_1_path   text,
  add column if not exists bild_detail_2_path   text,
  add column if not exists bild_zeichnung_1_path text,
  add column if not exists bild_zeichnung_2_path text,
  add column if not exists bild_zeichnung_3_path text,
  add column if not exists bild_energielabel_path text;

create index if not exists produkte_sortierung_fest_idx on public.produkte (sortierung_fest);
create index if not exists produkte_marker_info_idx     on public.produkte (marker_info);

-- ---------------------------------------------------------------------------
-- bereiche: Audit + Farbfeld (existiert 0004) + Sortierung_alt
-- ---------------------------------------------------------------------------
alter table public.bereiche
  add column if not exists endseite       integer,
  add column if not exists sortierung_alt integer,
  add column if not exists fm_erstellt_von text,
  add column if not exists fm_geaendert_von text;

-- ---------------------------------------------------------------------------
-- kategorien: Audit + Seitenangabe + Sortierungen + Icon-Werte (freitext)
-- ---------------------------------------------------------------------------
alter table public.kategorien
  add column if not exists seitenangabe   text,
  add column if not exists seitenzahl     integer,
  add column if not exists startseite     integer,
  add column if not exists endseite       integer,
  add column if not exists sortierung_alt integer,
  add column if not exists sortierung_ber integer,
  add column if not exists fm_erstellt_von text,
  add column if not exists fm_geaendert_von text;

-- ---------------------------------------------------------------------------
-- icons: Audit + Kategorie (Gruppierung)
-- ---------------------------------------------------------------------------
alter table public.icons
  add column if not exists icon_kategorie text,
  add column if not exists fm_erstellt_von text,
  add column if not exists fm_geaendert_von text;

-- ---------------------------------------------------------------------------
-- preise: Zusatzfelder aus FileMaker
-- ---------------------------------------------------------------------------
alter table public.preise
  add column if not exists external_id        text unique,
  add column if not exists preis_berechnet    numeric(10,2),
  add column if not exists preisimport_ok     text,
  add column if not exists preisimport_ok_ts  timestamptz,
  add column if not exists ek_lichtengros     numeric(10,2);

-- `ek` bedeutet historisch „EK Lichtengros" — wir benennen nicht um, um bestehende
-- Daten nicht zu brechen. Neue Daten füllen ek und ek_lichtengros identisch.

-- ---------------------------------------------------------------------------
-- katalog_seiten (neue Tabelle, entspricht FileMaker „Katalogseiten")
-- ---------------------------------------------------------------------------
create table if not exists public.katalog_seiten (
  id          uuid primary key default gen_random_uuid(),
  external_id text unique,
  seite       integer not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id)
);
create index if not exists katalog_seiten_seite_idx on public.katalog_seiten (seite);

alter table public.katalog_seiten enable row level security;
drop policy if exists "auth_select" on public.katalog_seiten;
drop policy if exists "auth_insert" on public.katalog_seiten;
drop policy if exists "auth_update" on public.katalog_seiten;
drop policy if exists "auth_delete" on public.katalog_seiten;
create policy "auth_select" on public.katalog_seiten for select to authenticated using (true);
create policy "auth_insert" on public.katalog_seiten for insert to authenticated with check (true);
create policy "auth_update" on public.katalog_seiten for update to authenticated using (true) with check (true);
create policy "auth_delete" on public.katalog_seiten for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- farbfelder (neue Tabelle, entspricht FileMaker „Farbfelder")
-- ---------------------------------------------------------------------------
create table if not exists public.farbfelder (
  id          uuid primary key default gen_random_uuid(),
  external_id text unique,
  name        text not null,
  code        text,          -- z.B. "#FFE4E1"
  rgb         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id)
);
create index if not exists farbfelder_code_idx on public.farbfelder (code);

alter table public.farbfelder enable row level security;
drop policy if exists "auth_select" on public.farbfelder;
drop policy if exists "auth_insert" on public.farbfelder;
drop policy if exists "auth_update" on public.farbfelder;
drop policy if exists "auth_delete" on public.farbfelder;
create policy "auth_select" on public.farbfelder for select to authenticated using (true);
create policy "auth_insert" on public.farbfelder for insert to authenticated with check (true);
create policy "auth_update" on public.farbfelder for update to authenticated using (true) with check (true);
create policy "auth_delete" on public.farbfelder for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- katalog_einstellungen: zusätzliche Felder aus FileMaker System-Tabelle
-- ---------------------------------------------------------------------------
alter table public.katalog_einstellungen
  add column if not exists version              text,
  add column if not exists seite1_titel         text,
  add column if not exists seite1_fusstext      text,
  add column if not exists seite1_preistext     text,
  add column if not exists seite99_fusstext_lg  text,
  add column if not exists seite99_fusstext_ek  text,
  add column if not exists preisaufschlag       numeric(6,2),
  add column if not exists preisaufschlag_pm    text,
  add column if not exists waehrung             text default 'EUR',
  add column if not exists filialen_italien     text,
  add column if not exists filialen_oesterreich text;
