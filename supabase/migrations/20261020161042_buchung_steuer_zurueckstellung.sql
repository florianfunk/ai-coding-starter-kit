-- Reversible, per-booking tax hold; independent of classification and AI.
alter table public.buchung
  add column steuer_zurueckgestellt boolean not null default false,
  add column steuer_zurueckgestellt_grund text,
  add column steuer_zurueckgestellt_am timestamptz,
  add constraint buchung_steuer_zurueckstellung_konsistent check (
    (steuer_zurueckgestellt and length(btrim(steuer_zurueckgestellt_grund)) between 1 and 1000
      and steuer_zurueckgestellt_grund is not null and steuer_zurueckgestellt_am is not null)
    or (not steuer_zurueckgestellt and steuer_zurueckgestellt_grund is null and steuer_zurueckgestellt_am is null)
  );

create function public.pruefe_steuer_zurueckstellung() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  profil public.firmenprofil%rowtype;
  p public.steuerperiode%rowtype;
  startdatum date;
  endedatum date;
  eltern public.buchung%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('steuer-hold:' || new.owner_id::text, 0));
  if tg_op = 'INSERT' then
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
    return new;
  end if;

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
      if p.periode = 0 then
        startdatum := make_date(p.jahr, 1, 1);
        endedatum := make_date(p.jahr, 12, 31);
      elsif profil.ust_va_rhythmus = 'quartalsweise' then
        startdatum := make_date(p.jahr, (p.periode - 1) * 3 + 1, 1);
        endedatum := (startdatum + interval '3 months' - interval '1 day')::date;
      else
        startdatum := make_date(p.jahr, p.periode, 1);
        endedatum := (startdatum + interval '1 month' - interval '1 day')::date;
      end if;
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
  return new;
end;
$$;

create trigger trg_buchung_steuer_hold_insert before insert on public.buchung
  for each row execute function public.pruefe_steuer_zurueckstellung();
create trigger trg_buchung_steuer_hold_update before update of
  steuer_zurueckgestellt, steuer_zurueckgestellt_grund, steuer_zurueckgestellt_am on public.buchung
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
          'grund', old.steuer_zurueckgestellt_grund, 'am', old.steuer_zurueckgestellt_am),
        'nachher', jsonb_build_object('zurueckgestellt', new.steuer_zurueckgestellt,
          'grund', new.steuer_zurueckgestellt_grund, 'am', new.steuer_zurueckgestellt_am)));
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
      (select count(*) from public.audit_eintrag where owner_id = new.owner_id
        and aktion in ('steuerlich_zurueckgestellt', 'steuerlich_wieder_aufgenommen')) then
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
