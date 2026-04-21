-- ============================================================================
-- PROJ-33: Performance-Optimierung Phase 1 — Views, Matviews, Indizes
-- ============================================================================
-- Additiv. Keine Änderungen an Basistabellen.
-- Rollback: drop materialized view / drop view / drop index / drop table.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Indizes (nur neue; bestehende aus 0001 werden nicht doppelt angelegt)
-- Bestehend: produkte(kategorie_id), produkte(bereich_id), produkte(artikelnummer),
--            produkte(artikel_bearbeitet), produkte(sortierung),
--            kategorien(bereich_id), kategorien(sortierung), icons(gruppe, sortierung),
--            produkt_bilder(produkt_id, sortierung), preise(produkt_id, gueltig_ab desc),
--            preise(status), produkt_icons PRIMARY KEY (produkt_id, icon_id) -> Leading-column produkt_id ok.
-- ---------------------------------------------------------------------------

-- Partieller Index: schnell alle "unbearbeitet"-Produkte finden (typische Filter-Query).
create index if not exists idx_produkte_unbearbeitet
  on public.produkte (id)
  where artikel_bearbeitet = false;

-- Partieller Index: schnell Produkte ohne Hauptbild finden.
create index if not exists idx_produkte_ohne_hauptbild
  on public.produkte (id)
  where hauptbild_path is null;

-- ---------------------------------------------------------------------------
-- Helper-Tabelle: Dirty-Flag für die Materialized View (Singleton)
-- ---------------------------------------------------------------------------
create table if not exists public._mv_refresh_queue (
  id                integer primary key default 1 check (id = 1),
  is_dirty          boolean not null default true,
  last_refreshed_at timestamptz
);

insert into public._mv_refresh_queue (id, is_dirty, last_refreshed_at)
values (1, true, null)
on conflict (id) do nothing;

alter table public._mv_refresh_queue enable row level security;

drop policy if exists "auth_select" on public._mv_refresh_queue;
create policy "auth_select" on public._mv_refresh_queue
  for select to authenticated using (true);

-- Kein INSERT/UPDATE/DELETE für authenticated: Schreibzugriff nur via security-definer Function
-- (refresh_mv_produkt_completeness und mark_mv_dirty).

-- ---------------------------------------------------------------------------
-- Materialized View: Completeness pro Produkt
-- ---------------------------------------------------------------------------
-- Spiegelt 1:1 die Logik in src/lib/completeness.ts (TOTAL_WEIGHT=90).
-- Pflichtfelder (je 10): Artikelnummer (immer erfüllt, text not null), Name (trim non-empty),
--   Kategorie (not null, immer erfüllt), Hauptbild (not null), Aktiver Preis (EXISTS in aktuelle_preise).
-- Optional: datenblatt_titel (7), datenblatt_text (7), datenblatt_template_id (6),
--   Technik (8: leistung_w OR lichtstrom_lm OR farbtemperatur_k OR schutzart_ip non-empty),
--   Abmessungen (6: masse_text non-empty OR laenge_mm OR breite_mm OR hoehe_mm),
--   Galerie-Bild (3), Icon (3).
-- Summe der Gewichte = 90. percent = round(earned / 90.0 * 100).
-- is_complete := percent > 80 (Schwelle wie im Frontend in page.tsx).

drop materialized view if exists public.mv_produkt_completeness;

create materialized view public.mv_produkt_completeness as
with flags as (
  select
    p.id as produkt_id,
    -- Pflichtfelder
    true as has_artikelnummer,                                                        -- text not null -> immer true
    (p.name is not null and btrim(p.name) <> '') as has_name,
    (p.kategorie_id is not null) as has_kategorie,
    (p.hauptbild_path is not null) as has_hauptbild,
    (ap.produkt_id is not null) as has_price,
    -- Optional
    (p.datenblatt_titel is not null and btrim(p.datenblatt_titel) <> '') as has_datenblatt_titel,
    (p.datenblatt_text is not null and btrim(p.datenblatt_text) <> '') as has_datenblatt_text,
    (p.datenblatt_template_id is not null) as has_datenblatt_template,
    (
      p.leistung_w is not null
      or p.lichtstrom_lm is not null
      or p.farbtemperatur_k is not null
      or (p.schutzart_ip is not null and btrim(p.schutzart_ip) <> '')
    ) as has_technik,
    (
      (p.masse_text is not null and btrim(p.masse_text) <> '')
      or p.laenge_mm is not null
      or p.breite_mm is not null
      or p.hoehe_mm is not null
    ) as has_masse,
    exists (select 1 from public.produkt_bilder pb where pb.produkt_id = p.id) as has_galerie,
    exists (select 1 from public.produkt_icons pi where pi.produkt_id = p.id) as has_icon
  from public.produkte p
  left join public.aktuelle_preise ap on ap.produkt_id = p.id
),
earned as (
  select
    produkt_id,
    has_price, has_hauptbild, has_name,
    has_datenblatt_titel, has_datenblatt_text, has_datenblatt_template,
    has_technik, has_masse, has_galerie, has_icon,
    (
        (case when has_artikelnummer      then 10 else 0 end)
      + (case when has_name                then 10 else 0 end)
      + (case when has_kategorie           then 10 else 0 end)
      + (case when has_hauptbild           then 10 else 0 end)
      + (case when has_price               then 10 else 0 end)
      + (case when has_datenblatt_titel    then  7 else 0 end)
      + (case when has_datenblatt_text     then  7 else 0 end)
      + (case when has_datenblatt_template then  6 else 0 end)
      + (case when has_technik             then  8 else 0 end)
      + (case when has_masse               then  6 else 0 end)
      + (case when has_galerie             then  3 else 0 end)
      + (case when has_icon                then  3 else 0 end)
    ) as earned_points
  from flags
)
select
  produkt_id,
  round(earned_points::numeric / 90.0 * 100.0)::int as percent,
  (round(earned_points::numeric / 90.0 * 100.0)::int > 80) as is_complete,
  has_price,
  has_hauptbild,
  has_name,
  has_datenblatt_titel,
  has_datenblatt_text,
  has_datenblatt_template,
  has_technik,
  has_masse,
  has_galerie,
  has_icon
from earned;

-- Unique index für REFRESH CONCURRENTLY
create unique index if not exists mv_produkt_completeness_pk
  on public.mv_produkt_completeness (produkt_id);

-- Initial-Refresh (kein CONCURRENTLY beim ersten Mal — MV wurde gerade angelegt)
refresh materialized view public.mv_produkt_completeness;

-- ---------------------------------------------------------------------------
-- View: Produkt-Listing (eine Query für Produktliste)
-- ---------------------------------------------------------------------------
-- Liefert alle Produkt-Spalten plus gejointe Felder:
--   bereich_name, kategorie_name, hat_preis, icon_count, galerie_count,
--   completeness_percent, completeness_complete.
drop view if exists public.v_produkt_listing;

create view public.v_produkt_listing as
select
  p.*,
  b.name as bereich_name,
  k.name as kategorie_name,
  (ap.produkt_id is not null) as hat_preis,
  (select count(*) from public.produkt_icons pi where pi.produkt_id = p.id)::int as icon_count,
  (select count(*) from public.produkt_bilder pb where pb.produkt_id = p.id)::int as galerie_count,
  coalesce(mv.percent, 0) as completeness_percent,
  coalesce(mv.is_complete, false) as completeness_complete
from public.produkte p
left join public.bereiche b    on b.id = p.bereich_id
left join public.kategorien k  on k.id = p.kategorie_id
left join public.aktuelle_preise ap on ap.produkt_id = p.id
left join public.mv_produkt_completeness mv on mv.produkt_id = p.id;

-- ---------------------------------------------------------------------------
-- View: Dashboard-Stats (eine Zeile, alle Kennzahlen)
-- ---------------------------------------------------------------------------
drop view if exists public.v_dashboard_stats;

create view public.v_dashboard_stats as
with
  b_cnt   as (select count(*)::int as c from public.bereiche),
  k_cnt   as (select count(*)::int as c from public.kategorien),
  p_cnt   as (select count(*)::int as c from public.produkte),
  pr_cnt  as (select count(*)::int as c from public.preise),
  i_cnt   as (select count(*)::int as c from public.icons),
  ohne_preis as (
    select count(*)::int as c
    from public.produkte p
    where not exists (select 1 from public.aktuelle_preise ap where ap.produkt_id = p.id)
  ),
  ohne_bild as (
    select count(*)::int as c
    from public.produkte
    where hauptbild_path is null
  ),
  unbearbeitet as (
    select count(*)::int as c
    from public.produkte
    where artikel_bearbeitet = false
  ),
  mv_agg as (
    select
      coalesce(round(avg(percent))::int, 0) as avg_percent,
      count(*) filter (where percent > 80)::int as complete_count,
      count(*) filter (where percent <= 80)::int as needs_attention_count
    from public.mv_produkt_completeness
  )
select
  b_cnt.c    as bereiche_count,
  k_cnt.c    as kategorien_count,
  p_cnt.c    as produkte_count,
  pr_cnt.c   as preise_count,
  i_cnt.c    as icons_count,
  ohne_preis.c    as ohne_preis_count,
  ohne_bild.c     as ohne_bild_count,
  unbearbeitet.c  as unbearbeitet_count,
  mv_agg.avg_percent         as avg_completeness,
  mv_agg.complete_count      as complete_count,
  mv_agg.needs_attention_count as needs_attention_count,
  case
    when p_cnt.c = 0 then 0
    else round(100.0 * mv_agg.complete_count / nullif(p_cnt.c, 0))::int
  end as complete_percent
from b_cnt, k_cnt, p_cnt, pr_cnt, i_cnt,
     ohne_preis, ohne_bild, unbearbeitet, mv_agg;

-- ---------------------------------------------------------------------------
-- Grants: Views/MV erben RLS nicht automatisch — explizit via GRANT steuern.
-- Da alle authenticated User alle Produkte sehen dürfen, ist SELECT-Grant ausreichend.
-- ---------------------------------------------------------------------------
grant select on public.mv_produkt_completeness to authenticated;
grant select on public.v_produkt_listing       to authenticated;
grant select on public.v_dashboard_stats       to authenticated;
