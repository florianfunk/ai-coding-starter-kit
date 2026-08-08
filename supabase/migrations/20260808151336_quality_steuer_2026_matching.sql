-- Quality-Pass 2026: amtlicher ESt-Tarif, FK-Indizes und RLS-Performance.

-- Amtlicher §32a-EStG-Tarif 2026 für alle vorhandenen Mandantenprofile.
insert into est_tarif (
  owner_id,
  jahr,
  grundfreibetrag,
  zonen,
  soli_satz,
  soli_freigrenze
)
select
  owner_id,
  2026,
  12348.00,
  '[
    {"ab":0,"art":"null"},
    {"ab":12349,"art":"progression","a":914.51,"b":1400,"d":0,"basis":12348},
    {"ab":17800,"art":"progression","a":173.10,"b":2397,"d":1034.87,"basis":17799},
    {"ab":69879,"art":"linear","m":0.42,"c":11135.63},
    {"ab":277826,"art":"linear","m":0.45,"c":19470.38}
  ]'::jsonb,
  0.055,
  20350.00
from firmenprofil
on conflict (owner_id, jahr) do update set
  grundfreibetrag = excluded.grundfreibetrag,
  zonen = excluded.zonen,
  soli_satz = excluded.soli_satz,
  soli_freigrenze = excluded.soli_freigrenze;

-- FK-Indizes: Spalten müssen als erstes Indexattribut vorkommen, damit
-- Deletes/Updates der referenzierten Zeilen nicht in Seq-Scans enden.
create index if not exists idx_buchung_import_lauf_fk
  on buchung(import_lauf_id) where import_lauf_id is not null;
create index if not exists idx_buchung_parent_fk
  on buchung(parent_buchung_id) where parent_buchung_id is not null;
create index if not exists idx_buchung_regel_fk
  on buchung(regel_id) where regel_id is not null;
create index if not exists idx_chat_aktion_audit_fk
  on chat_aktion(audit_eintrag_id) where audit_eintrag_id is not null;
create index if not exists idx_chat_aktion_nachricht_fk
  on chat_aktion(nachricht_id);
create index if not exists idx_chat_aktion_owner_fk
  on chat_aktion(owner_id);
create index if not exists idx_chat_nachricht_owner_fk
  on chat_nachricht(owner_id);
create index if not exists idx_job_lauf_konto_fk
  on job_lauf(konto_id) where konto_id is not null;

-- `auth.uid()` einmal pro Statement statt einmal pro geprüfter Zeile
-- auswerten. Die vorhandenen Policy-Namen, Rollen und Befehle bleiben gleich.
do $$
declare
  p record;
  statement text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
  loop
    statement := format(
      'alter policy %I on %I.%I',
      p.policyname,
      p.schemaname,
      p.tablename
    );
    if p.qual is not null then
      statement := statement || format(
        ' using (%s)',
        replace(p.qual, 'auth.uid()', '(select auth.uid())')
      );
    end if;
    if p.with_check is not null then
      statement := statement || format(
        ' with check (%s)',
        replace(p.with_check, 'auth.uid()', '(select auth.uid())')
      );
    end if;
    execute statement;
  end loop;
end
$$;
