# PROJ-15: Drag-and-Drop-Sortierung

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-3, PROJ-4, PROJ-5 (Bereiche/Kategorien/Produkte CRUD)

## User Stories
- Als Nutzer moechte ich Bereiche per Drag-and-Drop umsortieren koennen, damit ich die Katalogreihenfolge intuitiv festlegen kann.
- Als Nutzer moechte ich Kategorien innerhalb eines Bereichs per Drag-and-Drop sortieren koennen.
- Als Nutzer moechte ich Produkte innerhalb einer Kategorie per Drag-and-Drop sortieren koennen.

## Acceptance Criteria
- [ ] Drag-Handle links an jeder Zeile in der Bereich-/Kategorie-/Produkt-Liste
- [ ] Drag-Preview zeigt den Namen des gezogenen Elements
- [ ] Drop-Zone visuell hervorgehoben (blaue Linie zwischen Elementen)
- [ ] Nach Drop: neue Sortierung wird automatisch gespeichert
- [ ] Sortierungszahlen werden in 10er-Schritten vergeben (10, 20, 30...) fuer spaeteres Einfuegen
- [ ] Funktioniert auf Touch-Geraeten (Tablets)
- [ ] Fallback: Sortierungszahl-Input bleibt als Alternative erhalten

## Edge Cases
- Sehr lange Listen (419 Produkte) -> Drag-and-Drop nur auf der aktuellen Seite (50er Pagination)
- Zwei Nutzer sortieren gleichzeitig -> Letzte Aenderung gewinnt
- Drag ueber Seitenraender -> Auto-Scroll
