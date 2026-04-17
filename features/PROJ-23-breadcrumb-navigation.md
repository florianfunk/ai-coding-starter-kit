# PROJ-23: Breadcrumb-Navigation

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-3 (Bereiche verwalten)
- Requires: PROJ-4 (Kategorien verwalten)
- Requires: PROJ-5 (Produkte verwalten)

## User Stories
- Als Nutzer möchte ich auf jeder Detailseite sehen, wo ich mich in der Hierarchie befinde (z.B. LED Strip > 60 SMD/MT > BL13528).
- Als Nutzer möchte ich durch Klick auf eine Ebene direkt dorthin navigieren können.

## Acceptance Criteria
- [ ] Breadcrumb-Leiste unter dem Page-Header auf allen Detail-/Bearbeitungsseiten
- [ ] Hierarchie: Dashboard > [Bereich] > [Kategorie] > [Produkt] > [Aktion]
- [ ] Jede Ebene ist ein klickbarer Link
- [ ] Aktuelle Seite ist nicht verlinkt (nur Text)
- [ ] Responsive: auf Mobile als scrollbare horizontale Leiste
- [ ] Funktioniert auch auf Nicht-Produkt-Seiten (z.B. Einstellungen > Filialen)

## Edge Cases
- Produkt ohne Kategorie → Breadcrumb überspringt Kategorie-Ebene
- Sehr lange Bereichsnamen → Text wird abgekürzt mit "..."

## Technical Requirements
- shadcn/ui Komponenten: Breadcrumb
- Breadcrumb-Daten aus URL-Segmenten + Datenbank-Lookups für Namen
- Rendering < 100 ms (keine zusätzlichen DB-Queries wenn Daten bereits auf der Seite geladen)

---
<!-- Sections below are added by subsequent skills -->
