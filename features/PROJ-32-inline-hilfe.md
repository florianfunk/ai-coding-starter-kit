# PROJ-32: Inline-Hilfe / FAQ

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Keine

## User Stories
- Als neuer Nutzer möchte ich kontextbezogene Hilfetexte sehen, die mir erklären, was die Felder und Funktionen bedeuten.
- Als Nutzer möchte ich eine zentrale FAQ-Seite haben, auf der die häufigsten Fragen beantwortet werden.

## Acceptance Criteria
- [ ] Route `/hilfe` mit FAQ-Seite (Accordion-Stil)
- [ ] FAQ-Themen: "Wie lege ich ein Produkt an?", "Wie ändere ich Preise?", "Wie erstelle ich ein Datenblatt?", "Wie exportiere ich den Katalog?", "Was bedeuten die technischen Felder?"
- [ ] Info-Icons neben komplexen Feldern im Produkt-Formular (z.B. "UGR", "SDCM", "Schutzart IP")
- [ ] Klick auf Info-Icon zeigt Tooltip/Popover mit Erklärung
- [ ] Hilfe-Link im Hauptmenü (Fragezeichen-Icon)
- [ ] Inhalte als einfacher Markdown/Text in der App (kein externes CMS)

## Edge Cases
- Tooltip auf Touch-Geräten → Klick statt Hover
- Sehr lange Erklärungen → Popover mit Scroll
- FAQ-Seite leer → "Hilfe-Inhalte werden ergänzt" (Platzhalter)
