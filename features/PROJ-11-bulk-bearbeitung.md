# PROJ-11: Bulk-Bearbeitung

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-3, PROJ-5 (Bereiche/Produkte CRUD)

## User Stories
- Als Nutzer moechte ich mehrere Produkte gleichzeitig auswaehlen und deren Bereich/Kategorie/Status aendern koennen, damit ich nicht jedes einzeln bearbeiten muss.
- Als Nutzer moechte ich alle ausgewaehlten Produkte auf einmal als "bearbeitet" markieren koennen.
- Als Nutzer moechte ich mehrere Produkte auf einmal einer anderen Kategorie zuweisen koennen.
- Als Nutzer moechte ich die Auswahl ueber eine "Alle auswaehlen"-Checkbox steuern koennen.

## Acceptance Criteria
- [ ] Checkboxen in der Produkt-Tabelle fuer Mehrfachauswahl
- [ ] "Alle auswaehlen"-Checkbox im Tabellenkopf (betrifft aktuelle Seite)
- [ ] Aktions-Dropdown erscheint wenn >=1 Produkt ausgewaehlt: "Status aendern", "Kategorie aendern", "Bereich aendern", "Loeschen"
- [ ] Bestaetigungsdialog vor Bulk-Loeschen mit Anzahl der betroffenen Produkte
- [ ] Erfolgsmeldung nach Bulk-Aktion mit Anzahl der geaenderten Produkte
- [ ] Auswahl wird nach Seitenwechsel zurueckgesetzt
- [ ] Bulk-Kategorie-Aenderung zeigt Dropdown mit allen Kategorien

## Edge Cases
- Was wenn ein ausgewaehltes Produkt zwischenzeitlich geloescht wurde? -> Warnung, Rest wird geaendert
- Was bei Bulk-Loeschen von Produkten mit Preisen? -> Cascade Delete (Preise werden mitgeloescht)
- Was wenn alle Produkte einer Kategorie verschoben werden? -> Kategorie bleibt leer, kein Fehler
- Bulk-Aktion waehrend anderer Nutzer dasselbe Produkt bearbeitet? -> Letzte Aenderung gewinnt
