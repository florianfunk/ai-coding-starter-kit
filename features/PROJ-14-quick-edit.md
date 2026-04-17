# PROJ-14: Quick-Edit & Inline-Bearbeitung

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-5 (Produkte CRUD)

## User Stories
- Als Nutzer moechte ich Sortierungszahlen direkt in der Produkt-Tabelle bearbeiten koennen, ohne die Detailseite oeffnen zu muessen.
- Als Nutzer moechte ich den Bearbeitungs-Status eines Produkts direkt in der Liste per Klick umschalten koennen.
- Als Nutzer moechte ich den Produktnamen inline bearbeiten koennen.

## Acceptance Criteria
- [ ] Klick auf Sortierungszahl -> Inline-Input -> Enter/Blur speichert -> Toast-Feedback
- [ ] Status-Toggle (bearbeitet/unbearbeitet) per Klick auf Badge in der Tabelle
- [ ] Doppelklick auf Produktname -> Inline-Edit -> Enter speichert, Escape bricht ab
- [ ] Visuelle Markierung waehrend des Editierens (z.B. blauer Rand)
- [ ] Aenderungen werden sofort persistiert (kein expliziter Speichern-Button)
- [ ] Optimistic UI: Wert wird sofort angezeigt, bei Fehler zurueckgerollt

## Edge Cases
- Ungueltige Sortierungszahl (z.B. Buchstaben) -> Validierung, alter Wert bleibt
- Netzwerkfehler beim Speichern -> Toast-Error, Wert wird zurueckgesetzt
