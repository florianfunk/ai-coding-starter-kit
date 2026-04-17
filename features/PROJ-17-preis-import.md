# PROJ-17: Excel/CSV-Import fuer Preise

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-6 (Preisverwaltung)

## User Stories
- Als Nutzer moechte ich eine Excel/CSV-Datei mit Preisen hochladen koennen, damit ich nicht 419 Preise einzeln eintippen muss.
- Als Nutzer moechte ich vor dem Import eine Vorschau der erkannten Daten sehen und Spalten zuordnen koennen.
- Als Nutzer moechte ich nach dem Import einen Bericht sehen, wie viele Preise aktualisiert/angelegt/uebersprungen wurden.

## Acceptance Criteria
- [ ] Import-Button auf der Produkt-Uebersicht oder als eigene Route `/produkte/import`
- [ ] Datei-Upload fuer .xlsx, .csv (max 5 MB)
- [ ] Spalten-Mapping-Dialog: Nutzer ordnet Spalten zu (Artikelnummer, Listenpreis, EK Lichtengros, EK Eisenkeil, Gueltig ab)
- [ ] Vorschau zeigt erste 10 Zeilen mit erkannten Werten
- [ ] Matching per Artikelnummer (case-insensitive)
- [ ] Nicht gefundene Artikelnummern → Warnung im Bericht, kein Abbruch
- [ ] Bestaetigungsdialog: "X Preise werden aktualisiert, Y nicht gefunden. Fortfahren?"
- [ ] Nach Import: Zusammenfassung (aktualisiert, angelegt, uebersprungen, Fehler)
- [ ] Option: alte Preise automatisch auf "inaktiv" setzen

## Edge Cases
- CSV mit Semikolon-Trennung (deutsch) → automatische Erkennung oder Auswahl
- Leere Zellen in Preisspalten → Preis wird nicht geaendert
- Negative Preise → Warnung, aber Import moeglich
- Doppelte Artikelnummern in der Datei → letzte Zeile gewinnt
- Datei ohne Header-Zeile → manuelles Mapping erzwingen
