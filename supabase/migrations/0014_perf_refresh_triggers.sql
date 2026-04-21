-- ============================================================================
-- PROJ-33: Performance-Optimierung — Trigger & Refresh-Function
-- ============================================================================
-- Statement-Level-Trigger setzen nur Dirty-Flag. Der eigentliche
-- REFRESH MATERIALIZED VIEW läuft via RPC oder Cron — keine Last bei Writes.
-- Rollback: drop trigger / drop function.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- mark_mv_dirty: Einfacher Trigger, setzt is_dirty=true auf Queue-Singleton.
-- ---------------------------------------------------------------------------
create or replace function public.mark_mv_dirty()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public._mv_refresh_queue set is_dirty = true where id = 1;
  return null;
end;
$$;

-- Kein execute-Grant — Function wird nur von Triggern auf Tabellen aufgerufen,
-- die RLS-Policies ohnehin schon gesichert sind. security definer verhindert
-- Grant-Probleme bei der Ausführung aus Trigger-Kontext.

-- Trigger anlegen (idempotent: drop if exists)
drop trigger if exists trg_mark_mv_dirty_produkte         on public.produkte;
drop trigger if exists trg_mark_mv_dirty_produkt_icons    on public.produkt_icons;
drop trigger if exists trg_mark_mv_dirty_produkt_bilder   on public.produkt_bilder;
drop trigger if exists trg_mark_mv_dirty_preise           on public.preise;

create trigger trg_mark_mv_dirty_produkte
  after insert or update or delete on public.produkte
  for each statement execute function public.mark_mv_dirty();

create trigger trg_mark_mv_dirty_produkt_icons
  after insert or update or delete on public.produkt_icons
  for each statement execute function public.mark_mv_dirty();

create trigger trg_mark_mv_dirty_produkt_bilder
  after insert or update or delete on public.produkt_bilder
  for each statement execute function public.mark_mv_dirty();

create trigger trg_mark_mv_dirty_preise
  after insert or update or delete on public.preise
  for each statement execute function public.mark_mv_dirty();

-- ---------------------------------------------------------------------------
-- refresh_mv_produkt_completeness: Von Server-Code aufrufbar.
-- Refresht die MV nur, wenn is_dirty=true. Gibt JSON zurück.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_mv_produkt_completeness()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_dirty boolean;
  v_ts    timestamptz;
  v_did_refresh boolean := false;
begin
  select is_dirty into v_dirty from public._mv_refresh_queue where id = 1;

  if v_dirty then
    refresh materialized view concurrently public.mv_produkt_completeness;
    update public._mv_refresh_queue
       set is_dirty = false, last_refreshed_at = now()
     where id = 1
    returning last_refreshed_at into v_ts;
    v_did_refresh := true;
  else
    select last_refreshed_at into v_ts from public._mv_refresh_queue where id = 1;
  end if;

  return jsonb_build_object(
    'refreshed', v_did_refresh,
    'last_refreshed_at', v_ts
  );
end;
$$;

grant execute on function public.refresh_mv_produkt_completeness() to authenticated;
