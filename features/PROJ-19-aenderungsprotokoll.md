# PROJ-19: Aenderungsprotokoll

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-1 (Authentifizierung)

## User Stories
- Als Nutzer moechte ich sehen, wer wann welches Produkt/welchen Bereich zuletzt geaendert hat.
- Als Nutzer moechte ich auf einer zentralen Seite die letzten Aenderungen ueber alle Tabellen sehen.
- Als Nutzer moechte ich auf der Produktdetailseite die Aenderungshistorie dieses Produkts sehen.

## Acceptance Criteria
- [ ] Neue Tabelle `audit_log` mit: Zeitstempel, User-ID, Tabelle, Record-ID, Aktion (create/update/delete), geaenderte Felder (JSON diff)
- [ ] Automatische Protokollierung bei jeder Create/Update/Delete-Operation
- [ ] Route `/aktivitaet` zeigt die letzten 100 Aenderungen chronologisch
- [ ] Filterbar nach Tabelle (Bereiche/Kategorien/Produkte/Preise), Nutzer, Zeitraum
- [ ] Auf jeder Detailseite (Produkt, Kategorie, Bereich): "Letzte Aenderungen"-Abschnitt
- [ ] Anzeige: "Max Mustermann hat am 17.04.2026 den Listenpreis von 40,22 EUR auf 42,50 EUR geaendert"

## Edge Cases
- Bulk-Aenderungen → ein Audit-Eintrag pro geaendertem Produkt (nicht ein einziger fuer alle)
- Audit-Log wird nie geloescht (Append-only)
- Nutzer-Account wird geloescht → Audit-Eintraege bleiben, Name wird als Text gespeichert
