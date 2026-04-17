# PROJ-20: Datenblatt-Vorschau im Produkt (Split-View)

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-9 (PDF-Export Datenblatt)

## User Stories
- Als Nutzer moechte ich beim Bearbeiten eines Produkts gleichzeitig eine Live-Vorschau des Datenblatts sehen.
- Als Nutzer moechte ich Aenderungen an den Produktdaten sofort im Datenblatt reflektiert sehen, ohne die Seite zu wechseln.

## Acceptance Criteria
- [ ] Toggle-Button "Vorschau einblenden" auf der Produktdetailseite
- [ ] Split-View: Formular links (60%), Datenblatt-Preview rechts (40%)
- [ ] Preview zeigt das aktuelle Datenblatt-Layout (Lichtengros-Variante als Default)
- [ ] Layout-Umschalter (Lichtengros/Eisenkeil) im Preview-Bereich
- [ ] Preview aktualisiert sich automatisch bei Feldaenderungen (Debounce 500ms)
- [ ] Auf kleinen Bildschirmen (<1280px): Preview als ausklappbares Panel unten statt rechts
- [ ] "PDF herunterladen"-Button direkt in der Preview

## Edge Cases
- Produkt ohne Datenblatt-Vorlage → Hinweis "Keine Vorlage zugewiesen"
- Sehr lange Beschreibungstexte → Preview scrollbar
- Aenderungen am Produkt noch nicht gespeichert → Preview zeigt unsaved state mit Hinweis
