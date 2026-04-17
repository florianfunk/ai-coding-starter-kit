# PROJ-21: Vollstaendigkeits-Indikator

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-5 (Produkte CRUD)

## User Stories
- Als Nutzer moechte ich auf einen Blick sehen, wie vollstaendig ein Produkt ausgefuellt ist.
- Als Nutzer moechte ich in der Produkt-Uebersicht nach Vollstaendigkeit filtern koennen, um unvollstaendige Produkte gezielt nachzupflegen.
- Als Nutzer moechte ich auf dem Dashboard sehen, wie viel Prozent aller Produkte vollstaendig sind.

## Acceptance Criteria
- [ ] Fortschrittsbalken pro Produkt in der Tabelle (farbig: rot <50%, gelb 50-80%, gruen >80%)
- [ ] Berechnung basiert auf: Pflichtfelder (Artikelnr, Name, Kategorie, Hauptbild, mind. 1 Preis) + optionale Felder (techn. Daten, Beschreibung, Detail-Bilder)
- [ ] Tooltip zeigt fehlende Felder an ("Fehlend: Hauptbild, Listenpreis, Farbtemperatur")
- [ ] Filter in Produkt-Liste: "Nur unvollstaendige anzeigen"
- [ ] Dashboard-Widget: "X% der Produkte sind vollstaendig" mit Fortschrittsbalken
- [ ] Detailseite: Vollstaendigkeits-Box oben rechts mit Checkliste fehlender Felder

## Edge Cases
- Produkt ohne Kategorie → automatisch < 50%
- Produkt mit allen Pflichtfeldern aber keinen optionalen → 60% (nicht 100%)
- Neues leeres Produkt → 0%
