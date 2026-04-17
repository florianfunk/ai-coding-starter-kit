# PROJ-30: Excel/CSV-Export

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-5, PROJ-7 (Produkte + Suche/Filter)

## User Stories
- Als Nutzer möchte ich die aktuelle Produkt-Liste (inkl. aktiver Filter) als Excel/CSV herunterladen können.
- Als Nutzer möchte ich wählen können, welche Spalten exportiert werden sollen.
- Als Nutzer möchte ich die Preisliste als separaten Export herunterladen können.

## Acceptance Criteria
- [ ] "Exportieren"-Button in der Produkt-Übersicht
- [ ] Export respektiert aktive Filter und Suche (nur sichtbare Produkte werden exportiert)
- [ ] Spalten-Auswahl-Dialog: Grunddaten, Technische Daten, Preise, Bildpfade (checkboxes)
- [ ] Export-Formate: CSV (Semikolon-getrennt, UTF-8 BOM für Excel-Kompatibilität) und XLSX
- [ ] Preis-Export: eigener Button, exportiert Artikelnummer + Produktname + alle Preisspalten (Listenpreis, EK LG, EK EK) + Gültigkeitsdatum
- [ ] Download startet sofort (client-seitige Generierung für kleine Datenmengen, server-seitig für >1000 Zeilen)
- [ ] Dateiname enthält Datum: `Produktkatalog_2026-04-17.csv`

## Edge Cases
- Export mit 419 Produkten + allen Spalten → max 2 Sekunden
- Sonderzeichen in Feldwerten (Semikolons, Anführungszeichen) → korrekt escaped
- Leere Filter (alle Produkte) → vollständiger Export
