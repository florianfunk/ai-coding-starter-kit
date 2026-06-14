-- PROJ-20: Merkliste — einzelne Buchungen zum späteren Review merken.
--
-- Schlanker Bookmark-Status direkt auf der Buchung (kein Workflow, keine
-- Notiz, keine eigene Tabelle):
--   gemerkt_am IS NULL      → nicht gemerkt
--   gemerkt_am gesetzt      → auf der Merkliste (+ Zeitpunkt fürs Sortieren)
--
-- RLS bleibt unverändert: gemerkt_am liegt auf `buchung`, das bereits
-- owner-scoped abgesichert ist. Der Toggle läuft über die owner-gefilterte
-- API (POST /api/buchungen/[id]/merkliste).

alter table buchung
  add column if not exists gemerkt_am timestamptz;

-- Partieller Index: nur gemerkte Buchungen, sortiert nach Merk-Zeitpunkt —
-- deckt die Merkliste-Abfrage (owner_id + order by gemerkt_am desc) ab.
create index if not exists idx_buchung_gemerkt
  on buchung(owner_id, gemerkt_am desc)
  where gemerkt_am is not null;
