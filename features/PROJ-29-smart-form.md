# PROJ-29: Smart-Form (Produkt-Formular-Optimierung)

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-5 (Produkte CRUD)

## User Stories
- Als Nutzer möchte ich die häufigsten Produktfelder auf einer einzigen Ansicht sehen, ohne 5 Tabs durchklicken zu müssen.
- Als Nutzer möchte ich selten genutzte technische Felder bei Bedarf ein-/ausklappen können.
- Als Nutzer möchte ich abhängig vom Bereich (LED Strip vs. Leuchte vs. Driver) nur die relevanten Felder sehen.

## Acceptance Criteria
- [ ] Hauptbereich oben: Artikelnr, Name, Bereich, Kategorie, Hauptbild, Sortierung, Status — immer sichtbar
- [ ] Datenblatt-Sektion: Titel, 3x Beschreibungstexte — immer sichtbar
- [ ] Technische Daten als ausklappbare Accordion-Sektionen (Elektro, Licht, Mechanik, Thermisch, Sonstiges)
- [ ] Bereichsabhängige Feld-Relevanz: bei "LED STRIP" sind LED/m, Rollenlänge, Biegeradius prominent; bei "DRIVER" sind Nennstrom, Nennspannung prominent
- [ ] "Alle Felder einblenden"-Toggle für Power-User
- [ ] Accordion-Zustand wird im localStorage gespeichert (öffnet sich beim nächsten Mal gleich)
- [ ] Tab-Navigation entfällt (alles auf einer scrollbaren Seite)

## Edge Cases
- Bereich wechseln → Feld-Relevanz aktualisiert sich dynamisch
- Neues Produkt ohne Bereich → alle Sektionen eingeklappt
- Bildschirmhöhe < 768px → Accordions standardmäßig eingeklappt
