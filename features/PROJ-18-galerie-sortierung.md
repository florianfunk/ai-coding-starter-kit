# PROJ-18: Galerie-Bilder sortierbar

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-5 (Produkte CRUD)

## User Stories
- Als Nutzer moechte ich die Reihenfolge der Produktbilder per Drag-and-Drop aendern koennen.
- Als Nutzer moechte ich das Hauptbild eines Produkts durch Klick aus der Galerie auswaehlen koennen.

## Acceptance Criteria
- [ ] Drag-and-Drop-Sortierung der Galerie-Bilder im Produkt-Bearbeitungsmodus
- [ ] Visuelle Drag-Vorschau (Thumbnail wird mitgezogen)
- [ ] Neue Reihenfolge wird sofort persistiert
- [ ] "Als Hauptbild setzen"-Option per Rechtsklick oder Button auf jedem Galerie-Bild
- [ ] Hauptbild wird visuell hervorgehoben (z.B. Stern-Icon, dickerer Rand)

## Edge Cases
- Nur ein Bild in der Galerie → Drag nicht moeglich, kein Handle anzeigen
- Bild-Upload waehrend Drag → neues Bild erscheint am Ende
- Bild loeschen waehrend Drag → Drag abbrechen
