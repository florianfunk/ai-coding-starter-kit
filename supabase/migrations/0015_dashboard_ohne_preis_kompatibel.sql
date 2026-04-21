-- ============================================================================
-- 0015 — Dashboard-Kompatibilität: ohne_preis_count wie bisher
--
-- Ausgangslage: v_dashboard_stats.ohne_preis_count aus 0013 zählt Produkte
-- ohne *aktiven, gültigen* Preis (via aktuelle_preise). Die bisherige
-- Dashboard-Logik in src/app/page.tsx hingegen zählte Produkte ohne *jegliche*
-- preise-Row. Die Zahlen weichen ab (12 vs 135) — das wäre eine sichtbare
-- Regression.
--
-- Lösung: View neu aufbauen, Semantik anpassen auf "ohne irgendeinen Preis-
-- Eintrag" (entspricht Frontend-Verhalten), zusätzlich neue Spalte
-- ohne_aktiven_preis_count für zukünftige Nutzung.
--
-- Rollback: Original-Definition aus 0013 wiederherstellen (siehe dortige SQL).
-- ============================================================================

drop view if exists public.v_dashboard_stats;

create view public.v_dashboard_stats as
with
  b_cnt   as (select count(*)::int as c from public.bereiche),
  k_cnt   as (select count(*)::int as c from public.kategorien),
  p_cnt   as (select count(*)::int as c from public.produkte),
  pr_cnt  as (select count(*)::int as c from public.preise),
  i_cnt   as (select count(*)::int as c from public.icons),
  ohne_preis as (
    -- Produkte ohne jeglichen Preis-Eintrag (Dashboard-kompatibel).
    select count(*)::int as c
    from public.produkte p
    where not exists (select 1 from public.preise pr where pr.produkt_id = p.id)
  ),
  ohne_aktiven_preis as (
    -- Produkte ohne aktiven, gültigen Preis (strengere Logik, für Future-Use).
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
  ohne_preis.c           as ohne_preis_count,
  ohne_aktiven_preis.c   as ohne_aktiven_preis_count,
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
     ohne_preis, ohne_aktiven_preis, ohne_bild, unbearbeitet, mv_agg;

grant select on public.v_dashboard_stats to authenticated;
