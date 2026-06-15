-- =====================================================================
-- PROJ-21: Lieferanten-Notizen.
--
-- Freie, datierte Notizen pro Lieferant — Gedaechtnisstuetzen dazu, wozu
-- die Buchungen eines Empfaengers gehoeren (Software, Lizenz, Vertrag,
-- Zweck). Anders als die Merkliste (PROJ-20, eine Spalte auf `buchung`)
-- gibt es hier MEHRERE Eintraege pro Lieferant → eigene Tabelle (1:n).
--
-- Schluessel ist der normalisierte Empfaenger (empfaenger_norm) — derselbe
-- Cache-Key, mit dem auch empfaenger_kenntnis, empfaenger_kuendigung und
-- buchung.empfaenger_normalisiert arbeiten. Damit gilt eine Notiz
-- automatisch fuer alle (auch zukuenftige) Buchungen desselben Empfaengers
-- und ueberlebt Re-Imports und Filterwechsel.
--
-- RLS-Struktur identisch zu empfaenger_kuendigung (PROJ-19).
-- =====================================================================

create table lieferant_notiz (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  empfaenger_norm  text not null
                    check (char_length(empfaenger_norm) between 2 and 300),
  rohwert_beispiel text,                          -- ein Beispiel-Rohname (UX)
  inhalt           text not null
                    check (char_length(inhalt) between 1 and 2000),
  erstellt_am      timestamptz not null default now(),
  aktualisiert_am  timestamptz not null default now()
);

-- Drilldown/Detail: alle Notizen eines Lieferanten (owner + norm).
create index idx_lieferant_notiz_empfaenger
  on lieferant_notiz(owner_id, empfaenger_norm);

-- Uebersichtsseite: zuletzt ergaenzte Lieferanten oben.
create index idx_lieferant_notiz_owner_aktualisiert
  on lieferant_notiz(owner_id, aktualisiert_am desc);

-- Kein updated_at-Trigger: set_updated_at() schreibt `updated_at`, diese
-- Tabelle nutzt `aktualisiert_am`. Wird beim PATCH explizit gesetzt.

alter table lieferant_notiz enable row level security;

create policy "lieferant_notiz_owner_select"
  on lieferant_notiz for select
  using (owner_id = auth.uid());

create policy "lieferant_notiz_owner_insert"
  on lieferant_notiz for insert
  with check (owner_id = auth.uid());

create policy "lieferant_notiz_owner_update"
  on lieferant_notiz for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "lieferant_notiz_owner_delete"
  on lieferant_notiz for delete
  using (owner_id = auth.uid());
