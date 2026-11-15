-- Ein datierter Wechsel von quartalsweiser auf monatliche USt-Voranmeldung.
-- Der bisherige Rhythmus bleibt für frühere Zeiträume erhalten.
alter table public.firmenprofil
  add column ust_va_rhythmus_vorher text;

alter table public.firmenprofil
  add constraint firmenprofil_ust_rhythmuswechsel_check check (
    ust_va_rhythmus_vorher is null or (
      ust_va_rhythmus_vorher = 'quartalsweise'
      and ust_va_rhythmus = 'monatlich'
      and rhythmus_gueltig_ab is not null
      and extract(day from rhythmus_gueltig_ab) = 1
      and extract(month from rhythmus_gueltig_ab) in (1, 4, 7, 10)
    )
  );

comment on column public.firmenprofil.ust_va_rhythmus_vorher is
  'Rhythmus vor rhythmus_gueltig_ab; NULL bedeutet keinen gespeicherten Wechsel.';

-- Gleiche Zeitraumprüfung auch in der DB, damit parallele Abschlüsse und
-- Profiländerungen keine Quartals-/Monats-Snapshots miteinander verwechseln.
create function public.ust_zeitraum_fuer_profil(p_jahr integer, p_periode integer, p_profil public.firmenprofil)
returns daterange language plpgsql immutable set search_path = public as $$
declare
  v_start date;
  v_ende date;
begin
  if p_periode between 1 and 4 and p_profil.ust_va_rhythmus_vorher = 'quartalsweise' then
    v_start := make_date(p_jahr, (p_periode - 1) * 3 + 1, 1);
    v_ende := (v_start + interval '3 months')::date;
    if v_ende <= p_profil.rhythmus_gueltig_ab then return daterange(v_start, v_ende, '[)'); end if;
  end if;
  if p_profil.ust_va_rhythmus = 'monatlich' and p_periode between 1 and 12 then
    v_start := make_date(p_jahr, p_periode, 1);
    v_ende := (v_start + interval '1 month')::date;
    if p_profil.ust_va_rhythmus_vorher is not null and v_start < p_profil.rhythmus_gueltig_ab then return null; end if;
  elsif p_profil.ust_va_rhythmus = 'quartalsweise' and p_periode between 1 and 4 then
    v_start := make_date(p_jahr, (p_periode - 1) * 3 + 1, 1);
    v_ende := (v_start + interval '3 months')::date;
  elsif p_profil.ust_va_rhythmus = 'jaehrlich' and p_periode = 0 then
    v_start := make_date(p_jahr, 1, 1);
    v_ende := make_date(p_jahr + 1, 1, 1);
  else return null;
  end if;
  return daterange(v_start, v_ende, '[)');
end;
$$;

create function public.pruefe_ust_rhythmuswechsel() returns trigger
language plpgsql set search_path = public as $$
declare
  p record;
  v_alt daterange;
  v_neu daterange;
begin
  if row(new.ust_va_rhythmus, new.ust_va_rhythmus_vorher, new.rhythmus_gueltig_ab)
    is not distinct from row(old.ust_va_rhythmus, old.ust_va_rhythmus_vorher, old.rhythmus_gueltig_ab) then return new; end if;
  if (
    new.ust_va_rhythmus = 'monatlich' and new.ust_va_rhythmus_vorher = 'quartalsweise'
    and ((old.ust_va_rhythmus = 'quartalsweise' and old.ust_va_rhythmus_vorher is null)
      or (old.ust_va_rhythmus = 'monatlich' and old.ust_va_rhythmus_vorher = 'quartalsweise'))
  ) is not true then
    raise exception 'Ein bestehender Rhythmus darf nur über einen datierten Wechsel von quartalsweise auf monatlich geändert werden.';
  end if;
  for p in select jahr, periode, snapshot from public.steuerperiode
    where owner_id = new.owner_id and art = 'ust_va' and status = 'abgeschlossen' loop
    v_neu := public.ust_zeitraum_fuer_profil(p.jahr, p.periode, new);
    if p.snapshot->'zeitraum'->>'von' is not null and p.snapshot->'zeitraum'->>'bis' is not null then
      v_alt := daterange((p.snapshot->'zeitraum'->>'von')::date, (p.snapshot->'zeitraum'->>'bis')::date + 1, '[)');
    else
      v_alt := public.ust_zeitraum_fuer_profil(p.jahr, p.periode, old);
    end if;
    if v_neu is null or v_alt is null or v_neu <> v_alt then
      raise exception 'Der Rhythmuswechsel würde einen abgeschlossenen USt-Zeitraum ändern. Bitte den Abschluss zuerst bewusst wieder öffnen.';
    end if;
  end loop;
  return new;
end;
$$;

create trigger trg_firmenprofil_ust_rhythmuswechsel before update of ust_va_rhythmus, ust_va_rhythmus_vorher, rhythmus_gueltig_ab
  on public.firmenprofil for each row execute function public.pruefe_ust_rhythmuswechsel();

create function public.pruefe_ust_abschluss_zeitraum() returns trigger
language plpgsql set search_path = public as $$
declare
  v_profil public.firmenprofil;
  v_erwartet daterange;
  v_snapshot daterange;
begin
  if new.art <> 'ust_va' or new.status <> 'abgeschlossen' then return new; end if;
  select * into v_profil from public.firmenprofil where owner_id = new.owner_id for share;
  v_erwartet := public.ust_zeitraum_fuer_profil(new.jahr, new.periode, v_profil);
  if new.snapshot->'zeitraum'->>'von' is not null and new.snapshot->'zeitraum'->>'bis' is not null then
    v_snapshot := daterange((new.snapshot->'zeitraum'->>'von')::date, (new.snapshot->'zeitraum'->>'bis')::date + 1, '[)');
  end if;
  if v_erwartet is null or v_snapshot is null or v_erwartet <> v_snapshot then
    raise exception 'Das Steuerprofil oder der Abgaberhythmus wurde geändert. Bitte die USt-Voranmeldung neu laden.';
  end if;
  return new;
end;
$$;

create trigger trg_steuerperiode_ust_zeitraum before insert or update of status, snapshot on public.steuerperiode
  for each row execute function public.pruefe_ust_abschluss_zeitraum();

create function public.protokolliere_ust_rhythmuswechsel() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into public.audit_eintrag(owner_id, entitaet, entitaet_id, aktion, quelle, details)
  values (new.owner_id, 'firmenprofil', new.id, 'ust_rhythmus_geaendert', 'nutzer',
    jsonb_build_object(
      'vorher', jsonb_build_object('ust_va_rhythmus', old.ust_va_rhythmus,
        'ust_va_rhythmus_vorher', old.ust_va_rhythmus_vorher, 'rhythmus_gueltig_ab', old.rhythmus_gueltig_ab),
      'nachher', jsonb_build_object('ust_va_rhythmus', new.ust_va_rhythmus,
        'ust_va_rhythmus_vorher', new.ust_va_rhythmus_vorher, 'rhythmus_gueltig_ab', new.rhythmus_gueltig_ab)));
  return new;
end;
$$;

create trigger trg_firmenprofil_ust_rhythmus_audit after update of ust_va_rhythmus, ust_va_rhythmus_vorher, rhythmus_gueltig_ab
  on public.firmenprofil for each row
  when (row(old.ust_va_rhythmus, old.ust_va_rhythmus_vorher, old.rhythmus_gueltig_ab)
    is distinct from row(new.ust_va_rhythmus, new.ust_va_rhythmus_vorher, new.rhythmus_gueltig_ab))
  execute function public.protokolliere_ust_rhythmuswechsel();
