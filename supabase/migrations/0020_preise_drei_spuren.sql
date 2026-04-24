-- ============================================================================
-- PROJ-6: Preisverwaltung — Drei-Spuren-Modell
-- ============================================================================
-- Altes Modell: Eine Zeile mit drei Preisspalten (listenpreis, ek_lichtengros,
--   ek_eisenkeil) plus globalem Status (aktiv/inaktiv).
-- Neues Modell: Jede Preisänderung einer Spur = eine eigene Zeile.
--   Spalten: produkt_id | spur | gueltig_ab | preis | quelle | created_at.
--   "Aktuell" wird nicht gespeichert, sondern in der View berechnet
--   (jüngster Eintrag pro Spur mit gueltig_ab <= current_date).
--
-- Migration: backfill der neuen Spalten aus den alten, dann alte droppen.
--   Da existierende Views (aktuelle_preise, v_produkt_listing, v_dashboard_stats,
--   mv_produkt_completeness) die alten Spalten nutzen, werden sie mit CASCADE
--   gedroppt und danach neu aufgebaut.
--
-- Zusätzlich: View `aktuelle_preise_flat` liefert pro Produkt EINE Zeile mit
--   den drei Preisen als separate Spalten — das ermöglicht minimal-invasive
--   Umstellung der bestehenden App-Stellen (Export, Kategorie, Vergleich,
--   Katalog-Job).
--
-- Rollback: Nicht trivial — alte Spalten enthalten keine Daten mehr.
--   Export der preise-Tabelle vor der Migration empfohlen.
-- ============================================================================

-- 1) Enum für die drei Spuren ---------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'preis_spur') then
    create type public.preis_spur as enum ('lichtengros', 'eisenkeil', 'listenpreis');
  end if;
end$$;

-- 2) Neue Spalten hinzufügen (nullable, bis Backfill fertig) --------------
alter table public.preise
  add column if not exists spur   public.preis_spur,
  add column if not exists quelle text not null default 'migration:alt-schema',
  add column if not exists preis  numeric(10,2);

-- 3) Abhängige Views/MViews droppen (benötigen die alten Spalten) ---------
drop view              if exists public.v_produkt_listing     cascade;
drop view              if exists public.v_dashboard_stats     cascade;
drop materialized view if exists public.mv_produkt_completeness cascade;
drop view              if exists public.aktuelle_preise       cascade;
drop view              if exists public.aktuelle_preise_flat  cascade;

-- 4) Backfill --------------------------------------------------------------
-- Regeln (Priorität): listenpreis IS NOT NULL (auch 0) → Spur 'listenpreis';
-- sonst COALESCE(ek_lichtengros, ek) IS NOT NULL → 'lichtengros';
-- sonst ek_eisenkeil IS NOT NULL → 'eisenkeil'.
-- 0-Werte bei listenpreis bedeuten "auf Anfrage" — bleiben erhalten.
-- Zeilen, bei denen keine Preisspalte gesetzt ist, werden am Ende entfernt
-- (safety net — laut Analyse existieren keine solchen Zeilen).

update public.preise
   set spur = 'listenpreis',
       preis = listenpreis
 where spur is null
   and listenpreis is not null;

update public.preise
   set spur = 'lichtengros',
       preis = coalesce(ek_lichtengros, ek)
 where spur is null
   and coalesce(ek_lichtengros, ek) is not null;

update public.preise
   set spur = 'eisenkeil',
       preis = ek_eisenkeil
 where spur is null
   and ek_eisenkeil is not null;

delete from public.preise where spur is null or preis is null;

-- 5) NOT NULL + CHECK constraints -----------------------------------------
alter table public.preise
  alter column spur  set not null,
  alter column preis set not null;

alter table public.preise
  drop constraint if exists preise_preis_nonneg;
alter table public.preise
  add  constraint preise_preis_nonneg check (preis >= 0);

-- 6) Alte Spalten droppen --------------------------------------------------
alter table public.preise
  drop column if exists listenpreis,
  drop column if exists ek,
  drop column if exists ek_lichtengros,
  drop column if exists ek_eisenkeil,
  drop column if exists status;

-- 7) preis_status-Enum droppen (nur noch in preise.status verwendet) ------
-- Sicherheitscheck: nur droppen, wenn keine Spalte mehr den Typ nutzt.
do $$
declare
  v_refs int;
begin
  select count(*) into v_refs
    from pg_type t
    join pg_attribute a on a.atttypid = t.oid
    join pg_class c on c.oid = a.attrelid
   where t.typname = 'preis_status'
     and c.relkind in ('r','v','m','p');
  if v_refs = 0 then
    execute 'drop type if exists public.preis_status';
  end if;
end$$;

-- 8) Index für "aktueller Preis pro Spur" ---------------------------------
drop index if exists public.preise_produkt_gueltig_ab_idx;
create index if not exists preise_produkt_spur_gueltig
  on public.preise (produkt_id, spur, gueltig_ab desc);

-- 9) View aktuelle_preise: eine Zeile pro (produkt, spur) ------------------
-- DISTINCT ON wählt pro (produkt_id, spur) den jüngsten Eintrag mit
-- gueltig_ab <= current_date. Tie-Breaker: created_at DESC.
create view public.aktuelle_preise as
select distinct on (produkt_id, spur)
  produkt_id,
  spur,
  id              as preis_id,
  gueltig_ab,
  preis,
  quelle
from public.preise
where gueltig_ab <= current_date
order by produkt_id, spur, gueltig_ab desc, created_at desc;

-- 10) View aktuelle_preise_flat: eine Zeile pro Produkt, 3 Preise als Spalten
-- Pivot via FILTER — liefert die aktuellen Preise der drei Spuren nebeneinander.
-- Backward-compat-Shape: listenpreis, ek_lichtengros, ek_eisenkeil, ek (=ek_lichtengros),
-- gueltig_ab (MAX über alle drei Spuren).
create view public.aktuelle_preise_flat as
select
  produkt_id,
  max(preis) filter (where spur = 'listenpreis')::numeric(10,2) as listenpreis,
  max(preis) filter (where spur = 'lichtengros')::numeric(10,2) as ek_lichtengros,
  max(preis) filter (where spur = 'eisenkeil')::numeric(10,2)   as ek_eisenkeil,
  max(preis) filter (where spur = 'lichtengros')::numeric(10,2) as ek,
  max(gueltig_ab)                                              as gueltig_ab
from public.aktuelle_preise
group by produkt_id;

-- 11) Materialized View: Completeness (Logik unverändert, Source auf flat) --
create materialized view public.mv_produkt_completeness as
with flags as (
  select
    p.id as produkt_id,
    true as has_artikelnummer,
    (p.name is not null and btrim(p.name) <> '') as has_name,
    (p.kategorie_id is not null) as has_kategorie,
    (p.hauptbild_path is not null) as has_hauptbild,
    (ap.produkt_id is not null) as has_price,
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
  left join public.aktuelle_preise_flat ap on ap.produkt_id = p.id
),
earned as (
  select
    flags.produkt_id,
    flags.has_price, flags.has_hauptbild, flags.has_name,
    flags.has_datenblatt_titel, flags.has_datenblatt_text, flags.has_datenblatt_template,
    flags.has_technik, flags.has_masse, flags.has_galerie, flags.has_icon,
    (
        (case when flags.has_artikelnummer      then 10 else 0 end)
      + (case when flags.has_name                then 10 else 0 end)
      + (case when flags.has_kategorie           then 10 else 0 end)
      + (case when flags.has_hauptbild           then 10 else 0 end)
      + (case when flags.has_price               then 10 else 0 end)
      + (case when flags.has_datenblatt_titel    then  7 else 0 end)
      + (case when flags.has_datenblatt_text     then  7 else 0 end)
      + (case when flags.has_datenblatt_template then  6 else 0 end)
      + (case when flags.has_technik             then  8 else 0 end)
      + (case when flags.has_masse               then  6 else 0 end)
      + (case when flags.has_galerie             then  3 else 0 end)
      + (case when flags.has_icon                then  3 else 0 end)
    ) as earned_points
  from flags
)
select
  produkt_id,
  round(earned_points::numeric / 90.0 * 100.0)::int as percent,
  (round(earned_points::numeric / 90.0 * 100.0)::int > 80) as is_complete,
  has_price, has_hauptbild, has_name,
  has_datenblatt_titel, has_datenblatt_text, has_datenblatt_template,
  has_technik, has_masse, has_galerie, has_icon
from earned;

create unique index if not exists mv_produkt_completeness_produkt_id_idx
  on public.mv_produkt_completeness (produkt_id);

-- 12) v_produkt_listing neu (Source auf flat) -----------------------------
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
left join public.bereiche b on b.id = p.bereich_id
left join public.kategorien k on k.id = p.kategorie_id
left join public.aktuelle_preise_flat ap on ap.produkt_id = p.id
left join public.mv_produkt_completeness mv on mv.produkt_id = p.id;

-- 13) v_dashboard_stats neu (ohne_aktiven_preis nutzt flat, Rest wie 0015) -
create view public.v_dashboard_stats as
with
  b_cnt   as (select count(*)::int as c from public.bereiche),
  k_cnt   as (select count(*)::int as c from public.kategorien),
  p_cnt   as (select count(*)::int as c from public.produkte),
  pr_cnt  as (select count(*)::int as c from public.preise),
  i_cnt   as (select count(*)::int as c from public.icons),
  ohne_preis as (
    select count(*)::int as c from public.produkte p
     where not exists (select 1 from public.preise pr where pr.produkt_id = p.id)
  ),
  ohne_aktiven_preis as (
    select count(*)::int as c from public.produkte p
     where not exists (select 1 from public.aktuelle_preise_flat ap where ap.produkt_id = p.id)
  ),
  ohne_bild as (
    select count(*)::int as c from public.produkte where hauptbild_path is null
  ),
  unbearbeitet as (
    select count(*)::int as c from public.produkte where artikel_bearbeitet = false
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
  ohne_preis.c         as ohne_preis_count,
  ohne_aktiven_preis.c as ohne_aktiven_preis_count,
  ohne_bild.c          as ohne_bild_count,
  unbearbeitet.c       as unbearbeitet_count,
  mv_agg.avg_percent           as avg_completeness,
  mv_agg.complete_count        as complete_count,
  mv_agg.needs_attention_count as needs_attention_count,
  case when p_cnt.c = 0 then 0
       else round(100.0 * mv_agg.complete_count / nullif(p_cnt.c, 0))::int end as complete_percent
from b_cnt, k_cnt, p_cnt, pr_cnt, i_cnt,
     ohne_preis, ohne_aktiven_preis, ohne_bild, unbearbeitet, mv_agg;

-- 14) Grants ---------------------------------------------------------------
grant select on public.aktuelle_preise         to authenticated, service_role;
grant select on public.aktuelle_preise_flat    to authenticated, service_role;
grant select on public.mv_produkt_completeness to authenticated, service_role;
grant select on public.v_produkt_listing       to authenticated, service_role;
grant select on public.v_dashboard_stats       to authenticated, service_role;

-- 15) Initial-Refresh der MV ------------------------------------------------
refresh materialized view public.mv_produkt_completeness;
