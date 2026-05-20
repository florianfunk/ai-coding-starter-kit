-- PROJ-15: Empfaenger-Normalisierung (Stufe 1 — Spalte + Index)
-- Fuegt buchung.empfaenger_normalisiert hinzu. Wird per App-Logik
-- (lib/classifier/normalize.ts) beim Konto-Import gesetzt und per
-- Backfill-Skript (scripts/backfill-empfaenger-normalisiert.ts) fuer
-- bestehende Buchungen nachgezogen.
--
-- Kein Default, nullable: Backfill kann schrittweise laufen, ohne dass
-- bestehende Rows blockieren. Der partielle Index spart Platz, weil
-- NULL-Zeilen waehrend des Rollouts ohnehin nicht gesucht werden.
--
-- RLS bleibt unveraendert — die Policy buchung_owner aus 0001 deckt die
-- neue Spalte automatisch ab.

alter table buchung add column empfaenger_normalisiert text;

create index idx_buchung_empf_norm
  on buchung(owner_id, empfaenger_normalisiert)
  where empfaenger_normalisiert is not null;
