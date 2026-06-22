-- PROJ-15 P2 (#3): "Häufige Prüflisten-Empfänger" — Kandidatenliste für Regeln.
--
-- Die Aggregation (GET /api/pruefliste/haeufige-empfaenger) lädt die offenen
-- Prüffälle owner-scoped: owner_id = <user> AND status = 'zur_pruefung',
-- sortiert nach buchung_datum. Ein partieller Composite-Index deckt genau diese
-- Abfrage ab — kein zusätzlicher Scan über bereits verbuchte Buchungen.
--
-- Bestehende Indizes idx_buchung_status (owner_id, status) und idx_buchung_datum
-- (owner_id, buchung_datum) decken das nur teilweise ab; dieser partielle Index
-- ist schmaler (nur die Review-Queue) und liefert die Sortier-Reihenfolge mit.
--
-- RLS bleibt unverändert (buchung ist bereits owner-scoped).
-- NICHT remote angewendet — Migration ist freigabe-pflichtig.

create index if not exists idx_buchung_pruefliste
  on buchung(owner_id, buchung_datum)
  where status = 'zur_pruefung';
