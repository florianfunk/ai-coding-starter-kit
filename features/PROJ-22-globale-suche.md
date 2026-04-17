# PROJ-22: Globale Suche (Cmd+K)

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-3, PROJ-4, PROJ-5 (Bereiche/Kategorien/Produkte existieren)

## User Stories
- Als Nutzer moechte ich mit Cmd+K einen Suchdialog oeffnen und sofort nach Bereichen, Kategorien und Produkten suchen koennen.
- Als Nutzer moechte ich aus den Suchergebnissen direkt zur Detailseite springen koennen.
- Als Nutzer moechte ich auch Aktionen (z.B. "Neues Produkt anlegen") ueber die Suche ausloesen koennen.

## Acceptance Criteria
- [ ] Cmd+K (Mac) / Ctrl+K (Windows) oeffnet Suchdialog (cmdk-Paket ist bereits installiert)
- [ ] Suchfeld mit Echtzeit-Ergebnissen (Debounce 200ms)
- [ ] Ergebnisse gruppiert: Bereiche, Kategorien, Produkte, Aktionen
- [ ] Maximal 5 Treffer pro Gruppe
- [ ] Navigieren mit Pfeiltasten, Auswaehlen mit Enter
- [ ] ESC schliesst den Dialog
- [ ] Aktionen-Sektion: "Neues Produkt", "Neuer Bereich", "Neue Kategorie", "Einstellungen", "Katalog exportieren"
- [ ] Suche durchsucht: Artikelnummer, Name, Bereichsname, Kategoriename
- [ ] Leerer Zustand: zeigt die Aktionen-Sektion

## Edge Cases
- Suche findet nichts → "Keine Ergebnisse fuer '...'" + Vorschlag "Neues Produkt anlegen?"
- Sonderzeichen in Suche → werden escaped
- Sehr schnelles Tippen → Debounce verhindert unnoetige Requests
