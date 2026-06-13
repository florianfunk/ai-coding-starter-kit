-- =====================================================================
-- Import-Historie pro Konto-Import.
--
-- Bisher gibt es zwar einen job_lauf-Eintrag pro Import (art='konto_import'),
-- aber keinen Foreign Key von buchung zurueck zum jeweiligen Lauf. Damit ist
-- kein gezieltes "diesen Import rueckgaengig machen" moeglich.
--
-- Diese Migration:
--   1) Erweitert job_lauf um Datei-Metadaten (Dateiname, Groesse, SHA-256-
--      Hash) — der bisherige Felder dateiname-Wert war als JSONB im
--      ergebnis-Feld nicht abfragbar.
--   2) Fuegt buchung.import_lauf_id hinzu (FK auf job_lauf, ON DELETE SET
--      NULL — wenn der Lauf-Eintrag geloescht wird, bleibt die Buchung).
--   3) Index zum schnellen Filtern "alle Buchungen dieses Imports".
--   4) Konto-Referenz im Lauf (job_lauf.konto_id), damit die Historie-UI
--      direkt "von Konto X" anzeigen kann ohne ueber Buchungen zu joinen.
-- =====================================================================

alter table job_lauf
  add column if not exists dateiname     text,
  add column if not exists dateigroesse  bigint,
  add column if not exists datei_hash    text,
  add column if not exists konto_id      uuid references konto(id) on delete set null;

create index if not exists idx_job_lauf_konto
  on job_lauf(owner_id, konto_id, created_at desc)
  where konto_id is not null;

alter table buchung
  add column if not exists import_lauf_id uuid
    references job_lauf(id) on delete set null;

create index if not exists idx_buchung_import_lauf
  on buchung(owner_id, import_lauf_id)
  where import_lauf_id is not null;
