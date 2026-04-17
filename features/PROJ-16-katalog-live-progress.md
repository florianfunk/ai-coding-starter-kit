# PROJ-16: Katalog-Export Live-Progress

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-10 (PDF-Export Gesamtkatalog)

## User Stories
- Als Nutzer moechte ich den Fortschritt des Katalog-PDF-Exports in Echtzeit sehen, ohne manuell refreshen zu muessen.
- Als Nutzer moechte ich benachrichtigt werden, wenn der Export fertig ist, auch wenn ich auf einer anderen Seite bin.

## Acceptance Criteria
- [ ] Progress-Bar aktualisiert sich automatisch alle 3 Sekunden (Polling)
- [ ] Fortschrittstext zeigt "Seite X von Y" oder Prozentzahl
- [ ] Bei Fertigstellung: automatischer Download-Link erscheint + Toast-Benachrichtigung
- [ ] Bei Fehler: Fehlermeldung wird sofort angezeigt (kein manuelles Refresh noetig)
- [ ] Job-Status bleibt auch nach Seitenwechsel sichtbar (z.B. Banner im Header oder Toast)
- [ ] Polling stoppt automatisch wenn Job abgeschlossen oder fehlgeschlagen

## Edge Cases
- Browser-Tab wird geschlossen -> kein Problem, Job laeuft auf Server weiter, beim naechsten Oeffnen wird Status geladen
- Zwei Jobs gleichzeitig -> beide werden in der Liste angezeigt
- Server-Neustart waehrend Job -> Job-Status auf "error" setzen
