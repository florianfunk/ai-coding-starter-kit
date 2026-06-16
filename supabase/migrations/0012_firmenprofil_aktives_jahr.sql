-- PROJ-22: Globaler Jahreswähler (app-weiter Jahres-Modus)
-- Speichert das aktuell aktive Buchhaltungs-Jahr als globale Wahrheit.
-- NULL = "Alle Jahre" (kein Datumsfilter). Single-User -> ein Wert pro Account.
--
-- Reine Spalten-Ergänzung an firmenprofil: KEINE RLS-Änderung nötig
-- (die bestehenden owner-scoped Policies decken die neue Spalte mit ab).

alter table firmenprofil
  add column if not exists aktives_jahr smallint
    check (aktives_jahr is null or aktives_jahr between 2000 and 2100);

comment on column firmenprofil.aktives_jahr is
  'PROJ-22: aktives Kalenderjahr für den globalen Jahres-Modus. NULL = Alle Jahre.';

-- Einmalige Vorbelegung: bestehende Profile auf ihr jüngstes Buchungsjahr
-- setzen (Default „letztes Jahr mit Daten"). Danach bedeutet NULL eindeutig
-- die bewusste Wahl „Alle Jahre". Profile ohne Buchungen bleiben NULL.
update firmenprofil f
set aktives_jahr = sub.max_jahr
from (
  select owner_id,
         max(extract(year from buchung_datum))::smallint as max_jahr
  from buchung
  where buchung_datum is not null
  group by owner_id
) sub
where f.owner_id = sub.owner_id
  and f.aktives_jahr is null
  and sub.max_jahr between 2000 and 2100;
