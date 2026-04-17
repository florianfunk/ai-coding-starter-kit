# PROJ-26: Dark Mode

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Keine (next-themes ist bereits installiert)

## User Stories
- Als Nutzer möchte ich die App im Dark Mode verwenden können, besonders bei abendlicher Katalogarbeit.
- Als Nutzer möchte ich zwischen Hell/Dunkel/System wählen können.

## Acceptance Criteria
- [ ] Toggle-Button im Header (Sonne/Mond-Icon)
- [ ] Drei Modi: Light, Dark, System (folgt Betriebssystem)
- [ ] Alle Seiten korrekt im Dark Mode darstellbar
- [ ] shadcn/ui-Komponenten passen sich automatisch an (CSS-Variablen)
- [ ] Markenfarben (lichtengros-Gruen, Eisenkeil-Blau) bleiben in beiden Modi erkennbar
- [ ] Bilder/Logos bleiben unveraendert (kein Invertieren)
- [ ] Auswahl wird im localStorage gespeichert und beim naechsten Besuch geladen
- [ ] Kein Flicker beim Laden (SSR-kompatibel ueber next-themes)

## Edge Cases
- System-Mode wechselt automatisch → App reagiert sofort
- PDF-Vorschau → immer heller Hintergrund (PDF ist weiss)
- Print-Stylesheet → immer Light Mode

## Technical Requirements
- next-themes als Theme-Provider (bereits installiert)
- ThemeProvider im Root-Layout
- CSS-Variablen fuer Dark Mode in globals.css (shadcn/ui Standard)
- shadcn/ui Komponenten: DropdownMenu (fuer Theme-Auswahl), Button

---
<!-- Sections below are added by subsequent skills -->
