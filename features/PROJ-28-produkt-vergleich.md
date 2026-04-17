# PROJ-28: Produkt-Vergleich

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-5 (Produkte verwalten)

## User Stories
- Als Nutzer moechte ich 2-3 Produkte nebeneinander vergleichen koennen, um Inkonsistenzen in den technischen Daten zu erkennen.
- Als Nutzer moechte ich Produkte aus der Tabelle zum Vergleich auswaehlen koennen.

## Acceptance Criteria
- [ ] "Vergleichen"-Button pro Produkt in der Tabelle (max 3 auswaehlbar)
- [ ] Schwebende Leiste unten: zeigt ausgewaehlte Produkte + "Vergleich starten"-Button
- [ ] Vergleichsseite: Tabelle mit Produkten als Spalten, technische Felder als Zeilen
- [ ] Unterschiedliche Werte werden farblich hervorgehoben (z.B. gelber Hintergrund)
- [ ] Identische Werte werden grau/unauffaellig dargestellt
- [ ] Nur Felder anzeigen, die bei mindestens einem Produkt ausgefuellt sind
- [ ] "Zurueck zur Liste"-Button behaelt die Auswahl bei

## Edge Cases
- Vergleich von Produkten aus verschiedenen Bereichen → alle technischen Felder zeigen, auch wenn nur eines befuellt ist
- Nur 1 Produkt ausgewaehlt und "Vergleich starten" → Hinweis "Mindestens 2 Produkte auswaehlen"
- Sehr viele technische Felder → vertikaler Scroll, sticky Header mit Produktnamen

## Technical Requirements
- Vergleichs-State in URL-Parametern (z.B. /produkte/vergleich?ids=1,2,3) fuer Teilbarkeit
- Diff-Logik: Werte pro Zeile vergleichen, bei Unterschied CSS-Klasse setzen
- shadcn/ui Komponenten: Table, Badge, Button, Card

---
<!-- Sections below are added by subsequent skills -->
