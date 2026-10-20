-- Reversible, per-booking tax hold; independent of classification and AI.
alter table public.buchung
  add column steuer_zurueckgestellt boolean not null default false,
  add column steuer_zurueckstellung_version bigint not null default 0 check (steuer_zurueckstellung_version >= 0),
  add column steuer_zurueckgestellt_grund text,
  add column steuer_zurueckgestellt_am timestamptz,
  add constraint buchung_steuer_zurueckstellung_konsistent check (
    (steuer_zurueckgestellt and length(btrim(steuer_zurueckgestellt_grund)) between 1 and 1000
      and steuer_zurueckgestellt_grund is not null and steuer_zurueckgestellt_am is not null)
    or (not steuer_zurueckgestellt and steuer_zurueckgestellt_grund is null and steuer_zurueckgestellt_am is null)
  );

-- Enrich historical snapshots without changing any tax amount. Where dates
-- cannot prove monthly vs quarterly, leave metadata absent; guard falls back
-- conservatively to the whole calendar year rather than allowing false holds.
with belegte_grenzen as (
  select p.id, p.jahr, p.periode, min(b.buchung_datum) as von, max(b.buchung_datum) as bis
  from public.steuerperiode p join public.buchung b on b.owner_id=p.owner_id
    and p.snapshot::text like '%' || b.id::text || '%'
  where p.art='ust_va' and p.status='abgeschlossen' and p.periode between 1 and 12
    and p.snapshot->'zeitraum' is null
  group by p.id,p.jahr,p.periode
), erkannt as (
  select g.*,
    case when periode between 1 and 4
      and von >= make_date(jahr,(periode-1)*3+1,1)
      and bis < (make_date(jahr,(periode-1)*3+1,1)+interval '3 months')::date
      and (extract(month from von) <> periode or extract(month from bis) <> periode)
      then 3
    when periode > 1 and von >= make_date(jahr,periode,1)
      and bis < (make_date(jahr,periode,1)+interval '1 month')::date then 1 end as monate
  from belegte_grenzen g
), fenster as (
  select id, monate, make_date(jahr,case when monate=3 then (periode-1)*3+1 else periode end,1) as start
  from erkannt where monate is not null
)
update public.steuerperiode p set snapshot = p.snapshot || jsonb_build_object(
  'zeitraum',jsonb_build_object('von',f.start::text,'bis',(f.start+make_interval(months=>f.monate)-interval '1 day')::date::text),
  'rhythmus',case when f.monate=3 then 'quartalsweise' else 'monatlich' end)
from fenster f where p.id=f.id;
update public.steuerperiode set snapshot=snapshot || jsonb_build_object(
  'zeitraum',jsonb_build_object('von',make_date(jahr,1,1)::text,'bis',make_date(jahr,12,31)::text),'rhythmus','jaehrlich')
where art='ust_va' and status='abgeschlossen' and periode=0 and snapshot->'zeitraum' is null;

create function public.pruefe_steuer_zurueckstellung() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  profil public.firmenprofil%rowtype;
  p public.steuerperiode%rowtype;
  startdatum date;
  endedatum date;
  eltern public.buchung%rowtype;
begin
  if tg_op = 'INSERT' then
    new.steuer_zurueckstellung_version := 0;
    if new.parent_buchung_id is not null then
      select * into eltern from public.buchung
        where id = new.parent_buchung_id and owner_id = new.owner_id for update;
      if not found then raise exception 'Teilbuchung ohne gültige eigene Elternbuchung.'; end if;
      if eltern.steuer_zurueckgestellt then
        raise exception 'Zurückgestellte Buchungen können nicht aufgeteilt werden. Bitte zuerst wieder aufnehmen.';
      end if;
    end if;
    if not new.steuer_zurueckgestellt then return new; end if;
  elsif new.steuer_zurueckgestellt is not distinct from old.steuer_zurueckgestellt
    and new.steuer_zurueckgestellt_grund is not distinct from old.steuer_zurueckgestellt_grund then
    new.steuer_zurueckgestellt_am := old.steuer_zurueckgestellt_am;
    new.steuer_zurueckstellung_version := old.steuer_zurueckstellung_version;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('steuer-hold:' || new.owner_id::text, 0));
  if exists (select 1 from public.buchung where parent_buchung_id = new.id and owner_id = new.owner_id) then
    raise exception 'Diese Buchung ist aufgeteilt. Bitte die einzelnen Teilbuchungen zurückstellen oder wieder aufnehmen.';
  end if;
  select * into profil from public.firmenprofil where owner_id = new.owner_id limit 1;
  for p in select * from public.steuerperiode where owner_id = new.owner_id and status = 'abgeschlossen' loop
    if p.art = 'wirtschaftsjahr' then
      startdatum := coalesce((p.snapshot #>> '{ergebnis,zeitraum,von}')::date,
        make_date(p.jahr, coalesce(profil.wirtschaftsjahr_beginn, 1), 1));
      endedatum := coalesce((p.snapshot #>> '{ergebnis,zeitraum,bis}')::date,
        (startdatum + interval '1 year' - interval '1 day')::date);
    else
      startdatum := coalesce((p.snapshot #>> '{zeitraum,von}')::date, make_date(p.jahr,1,1));
      endedatum := coalesce((p.snapshot #>> '{zeitraum,bis}')::date, make_date(p.jahr,12,31));
    end if;
    if new.buchung_datum between startdatum and endedatum then
      raise exception 'Die Steuerperiode ist bereits abgeschlossen. Bitte die betroffene Periode zuerst wieder öffnen.';
    end if;
  end loop;

  if new.steuer_zurueckgestellt then
    new.steuer_zurueckgestellt_grund := btrim(new.steuer_zurueckgestellt_grund);
    if new.steuer_zurueckgestellt_grund is null or length(new.steuer_zurueckgestellt_grund) not between 1 and 1000 then
      raise exception 'Bitte einen Grund mit 1 bis 1000 Zeichen angeben.';
    end if;
    new.steuer_zurueckgestellt_am := clock_timestamp();
  else
    new.steuer_zurueckgestellt_grund := null;
    new.steuer_zurueckgestellt_am := null;
  end if;
  new.steuer_zurueckstellung_version := case when tg_op='INSERT' then 1 else old.steuer_zurueckstellung_version+1 end;
  return new;
end;
$$;

create trigger trg_buchung_steuer_hold_insert before insert on public.buchung
  for each row execute function public.pruefe_steuer_zurueckstellung();
create trigger trg_buchung_steuer_hold_update before update of
  steuer_zurueckgestellt, steuer_zurueckgestellt_grund, steuer_zurueckgestellt_am, steuer_zurueckstellung_version on public.buchung
  for each row execute function public.pruefe_steuer_zurueckstellung();

create function public.audit_steuer_zurueckstellung() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.steuer_zurueckgestellt is distinct from old.steuer_zurueckgestellt
    or new.steuer_zurueckgestellt_grund is distinct from old.steuer_zurueckgestellt_grund then
    insert into public.audit_eintrag(owner_id, entitaet, entitaet_id, aktion, quelle, details)
    values(new.owner_id, 'buchung', new.id,
      case when new.steuer_zurueckgestellt then 'steuerlich_zurueckgestellt' else 'steuerlich_wieder_aufgenommen' end,
      'nutzer', jsonb_build_object(
        'vorher', jsonb_build_object('zurueckgestellt', old.steuer_zurueckgestellt,
          'grund', old.steuer_zurueckgestellt_grund, 'am', old.steuer_zurueckgestellt_am, 'version', old.steuer_zurueckstellung_version),
        'nachher', jsonb_build_object('zurueckgestellt', new.steuer_zurueckgestellt,
          'grund', new.steuer_zurueckgestellt_grund, 'am', new.steuer_zurueckgestellt_am, 'version', new.steuer_zurueckstellung_version)));
  end if;
  return new;
end;
$$;
create trigger trg_buchung_steuer_hold_audit after update of
  steuer_zurueckgestellt, steuer_zurueckgestellt_grund on public.buchung
  for each row execute function public.audit_steuer_zurueckstellung();

-- Closing and holding serialize. A snapshot calculated before a concurrent
-- hold must not be committed with that held booking still present.
create function public.pruefe_abschluss_steuer_zurueckstellung() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = 'abgeschlossen' then
    perform pg_advisory_xact_lock(hashtextextended('steuer-hold:' || new.owner_id::text, 0));
    if coalesce((new.snapshot->>'rueckstellungen_version')::bigint, 0) <>
      (select coalesce(sum(steuer_zurueckstellung_version),0) from public.buchung where owner_id = new.owner_id) then
      raise exception 'Rückstellungen wurden inzwischen geändert. Bitte die Auswertung neu laden und erneut abschließen.';
    end if;
    if exists (select 1 from public.buchung b
      where b.owner_id = new.owner_id and b.steuer_zurueckgestellt
        and new.snapshot::text like '%' || b.id::text || '%') then
      raise exception 'Zurückgestellte Buchungen im Abschluss erkannt. Bitte die Auswertung neu laden und erneut abschließen.';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_periode_steuer_hold before insert or update of status, snapshot on public.steuerperiode
  for each row execute function public.pruefe_abschluss_steuer_zurueckstellung();

revoke all on function public.pruefe_steuer_zurueckstellung() from public, anon;
revoke all on function public.audit_steuer_zurueckstellung() from public, anon;
revoke all on function public.pruefe_abschluss_steuer_zurueckstellung() from public, anon;

-- Audit remains readable/appendable by owner, but cannot be rewritten/deleted.
revoke update, delete on public.audit_eintrag from public, anon, authenticated;

create function public.steuer_rueckstellungs_version() returns bigint
language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(steuer_zurueckstellung_version),0)::bigint from public.buchung where owner_id=(select auth.uid());
$$;
revoke all on function public.steuer_rueckstellungs_version() from public, anon;
grant execute on function public.steuer_rueckstellungs_version() to authenticated;
