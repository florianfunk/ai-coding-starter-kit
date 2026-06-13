-- =====================================================================
-- Empfaenger-Kuendigungsliste.
--
-- Pro Empfaenger (genauer: pro normalisiertem Empfaenger des Owners) kann
-- man eine Kuendigungs-Absicht hinterlegen. Der Status ist eine kleine
-- Workflow-Maschine: offen → gekuendigt (Kuendigung verschickt) → beendet
-- (letzte Abbuchung war's). Erst dann verschwindet der Eintrag aus der
-- Tagesliste.
--
-- Schluessel auf empfaenger_norm — der gleiche Cache-Key, mit dem auch
-- empfaenger_kenntnis und buchung.empfaenger_normalisiert arbeiten. Damit
-- bleibt die Markierung bei Re-Imports erhalten und gilt automatisch fuer
-- alle Buchungen desselben Empfaengers (auch zukuenftige).
-- =====================================================================

create table empfaenger_kuendigung (
  owner_id         uuid not null references auth.users(id) on delete cascade,
  empfaenger_norm  text not null,
  rohwert_beispiel text,                          -- ein Beispiel-Rohname (UX)
  status           text not null default 'offen'
                    check (status in ('offen','gekuendigt','beendet')),
  notiz            text,
  markiert_am      timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (owner_id, empfaenger_norm)
);
create index idx_kuendigung_owner_status
  on empfaenger_kuendigung(owner_id, status, markiert_am desc);

create trigger trg_kuendigung_updated before update on empfaenger_kuendigung
  for each row execute function set_updated_at();

alter table empfaenger_kuendigung enable row level security;

create policy "empfaenger_kuendigung_owner_select"
  on empfaenger_kuendigung for select
  using (owner_id = auth.uid());

create policy "empfaenger_kuendigung_owner_insert"
  on empfaenger_kuendigung for insert
  with check (owner_id = auth.uid());

create policy "empfaenger_kuendigung_owner_update"
  on empfaenger_kuendigung for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "empfaenger_kuendigung_owner_delete"
  on empfaenger_kuendigung for delete
  using (owner_id = auth.uid());
