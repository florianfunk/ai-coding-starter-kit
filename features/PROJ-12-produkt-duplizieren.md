# PROJ-12: Produkt duplizieren

## Status: Planned
**Created:** 2026-04-17

## Dependencies
- Requires: PROJ-5 (Produkte CRUD)

## User Stories
- Als Nutzer moechte ich ein bestehendes Produkt als Vorlage kopieren koennen, damit ich bei aehnlichen LED-Strips nicht alle technischen Daten neu eingeben muss.
- Als Nutzer moechte ich beim Duplizieren die Artikelnummer anpassen koennen, bevor gespeichert wird.

## Acceptance Criteria
- [ ] "Duplizieren"-Button auf der Produktdetailseite
- [ ] Kopiert alle Felder ausser: ID, external_id, created_at, updated_at
- [ ] Artikelnummer wird mit Suffix "-KOPIE" vorbelegt
- [ ] Neues Produkt wird im Bearbeitungsmodus geoeffnet (nicht sofort gespeichert)
- [ ] Preise werden NICHT mitkopiert (frisches Produkt braucht eigene Preise)
- [ ] Icons werden mitkopiert
- [ ] Bilder werden mitkopiert (gleiche Storage-Pfade referenziert)

## Edge Cases
- Was wenn Artikelnummer mit "-KOPIE" schon existiert? -> "-KOPIE-2" usw. (aber Artikelnummer ist nicht mehr unique, also kein Hard-Error)
- Was wenn das Quellprodukt keine Kategorie hat? -> Duplikat auch ohne Kategorie
