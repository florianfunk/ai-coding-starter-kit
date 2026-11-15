-- In einer lokalen/Test-Datenbank NACH der Migration ausführen. Keine Änderungen bleiben erhalten.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000042');
insert into public.firmenprofil(owner_id, firmenname, inhaber, ust_va_rhythmus)
values ('00000000-0000-4000-8000-000000000042', 'Rhythmus-Test', 'Test', 'quartalsweise');
insert into public.steuerperiode(owner_id, art, jahr, periode, status, snapshot)
values ('00000000-0000-4000-8000-000000000042', 'ust_va', 2026, 1, 'abgeschlossen',
  '{"zeitraum":{"von":"2026-01-01","bis":"2026-03-31"},"rhythmus":"quartalsweise"}');
update public.firmenprofil set ust_va_rhythmus = 'monatlich', ust_va_rhythmus_vorher = 'quartalsweise',
  rhythmus_gueltig_ab = '2026-04-01' where owner_id = '00000000-0000-4000-8000-000000000042';

do $$
declare
  p public.firmenprofil;
  v_abgelehnt boolean;
begin
  select * into p from public.firmenprofil where owner_id = '00000000-0000-4000-8000-000000000042';
  assert public.ust_zeitraum_fuer_profil(2025, 2, p) = daterange('2025-04-01', '2025-07-01', '[)');
  assert public.ust_zeitraum_fuer_profil(2026, 1, p) = daterange('2026-01-01', '2026-04-01', '[)');
  assert public.ust_zeitraum_fuer_profil(2026, 2, p) is null;
  assert public.ust_zeitraum_fuer_profil(2026, 4, p) = daterange('2026-04-01', '2026-05-01', '[)');
  assert public.ust_zeitraum_fuer_profil(2027, 1, p) = daterange('2027-01-01', '2027-02-01', '[)');
  assert (select snapshot->>'rhythmus' from public.steuerperiode
    where owner_id=p.owner_id and jahr=2026 and periode=1) = 'quartalsweise';
  assert (select count(*) from public.audit_eintrag where owner_id=p.owner_id and aktion='ust_rhythmus_geaendert') = 1;

  -- Ein Tippfehler ist korrigierbar, solange kein Abschluss umgedeutet wird.
  update public.firmenprofil set rhythmus_gueltig_ab='2026-07-01' where owner_id=p.owner_id;
  update public.firmenprofil set rhythmus_gueltig_ab='2026-04-01' where owner_id=p.owner_id;

  -- Ein fehlgeschlagenes Audit muss den Profilwechsel vollständig zurückrollen.
  alter table public.audit_eintrag add constraint test_audit_failure check (aktion <> 'ust_rhythmus_geaendert') not valid;
  v_abgelehnt := false;
  begin
    update public.firmenprofil set rhythmus_gueltig_ab='2026-07-01' where owner_id=p.owner_id;
  exception when check_violation then v_abgelehnt := true;
  end;
  assert v_abgelehnt;
  assert (select rhythmus_gueltig_ab from public.firmenprofil where owner_id=p.owner_id) = '2026-04-01';
  alter table public.audit_eintrag drop constraint test_audit_failure;

  v_abgelehnt := false;
  begin
    update public.firmenprofil set ust_va_rhythmus_vorher=null where owner_id=p.owner_id;
  exception when raise_exception then v_abgelehnt := true;
  end;
  assert v_abgelehnt, 'Die historische Ausgangslage darf nicht gelöscht werden';

  v_abgelehnt := false;
  begin
    insert into public.steuerperiode(owner_id, art, jahr, periode, status, snapshot)
    values (p.owner_id, 'ust_va', 2026, 2, 'abgeschlossen',
      '{"zeitraum":{"von":"2026-04-01","bis":"2026-06-30"}}');
  exception when raise_exception then v_abgelehnt := true;
  end;
  assert v_abgelehnt, 'Ein veralteter paralleler Q2-Abschluss muss abgewiesen werden';

  insert into public.steuerperiode(owner_id, art, jahr, periode, status, snapshot)
  values (p.owner_id, 'ust_va', 2026, 4, 'abgeschlossen',
    '{"zeitraum":{"von":"2026-04-01","bis":"2026-04-30"},"rhythmus":"monatlich"}');

  v_abgelehnt := false;
  begin
    update public.firmenprofil set rhythmus_gueltig_ab = '2026-07-01' where owner_id=p.owner_id;
  exception when raise_exception then v_abgelehnt := true;
  end;
  assert v_abgelehnt, 'Die gespeicherte Historie darf nicht nachträglich überschrieben werden';

  -- Rückweg testen: auf offen setzen bleibt zulässig.
  update public.steuerperiode set status='offen', snapshot=null where owner_id=p.owner_id and periode=4;
end;
$$;
rollback;

-- Ein bestehender Q2-Abschluss verhindert die rückwirkende Umstellung ab April.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000043');
insert into public.firmenprofil(owner_id, firmenname, inhaber, ust_va_rhythmus)
values ('00000000-0000-4000-8000-000000000043', 'Rhythmus-Test', 'Test', 'quartalsweise');
insert into public.steuerperiode(owner_id, art, jahr, periode, status, snapshot)
values ('00000000-0000-4000-8000-000000000043', 'ust_va', 2026, 2, 'abgeschlossen',
  '{"zeitraum":{"von":"2026-04-01","bis":"2026-06-30"}}');
do $$
declare v_abgelehnt boolean := false;
begin
  begin
    update public.firmenprofil set ust_va_rhythmus='monatlich', ust_va_rhythmus_vorher='quartalsweise',
      rhythmus_gueltig_ab='2026-04-01' where owner_id='00000000-0000-4000-8000-000000000043';
  exception when raise_exception then v_abgelehnt := true;
  end;
  assert v_abgelehnt, 'Ein abgeschlossener Q2-Zeitraum muss den Wechsel ab April verhindern';
end;
$$;
rollback;
