# PROJ-13: Icon-Suche im Picker

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-5 (Produkte CRUD), bestehender Icon-Picker

## User Stories
- Als Nutzer moechte ich Icons im Auswahl-Dialog durchsuchen koennen, damit ich bei 33+ Icons schnell das richtige finde.
- Als Nutzer moechte ich eine "Zuletzt verwendet"-Sektion sehen, damit haeufig genutzte Icons schneller erreichbar sind.

## Acceptance Criteria
- [ ] Suchfeld oben im Icon-Picker (filtert nach Icon-Name und Gruppe)
- [ ] Echtzeit-Filterung beim Tippen (kein Submit noetig)
- [ ] Wenn Suchtext leer -> alle Icons gruppiert nach Kategorie anzeigen (wie bisher)
- [ ] Wenn keine Treffer -> "Kein Icon gefunden"-Hinweis
- [ ] "Zuletzt verwendet"-Sektion zeigt die letzten 5 zugewiesenen Icons des aktuellen Nutzers
- [ ] Funktioniert identisch im Produkt-Form und Kategorie-Form

## Edge Cases
- Suche mit Umlauten (oe, ue, ae) muss funktionieren
- Leerer Icon-Picker wenn keine Icons existieren -> hilfreicher Hinweis
