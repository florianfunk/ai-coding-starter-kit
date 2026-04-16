# PROJ-6: Preisverwaltung pro Produkt

## Status: Architected
**Created:** 2026-04-16
**Last Updated:** 2026-04-16

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-2 (Datenmodell)
- Requires: PROJ-5 (Produkte)

## User Stories
- Als Nutzer möchte ich pro Produkt mehrere Preis-Einträge mit Gültig-ab-Datum, EK (Einkaufspreis), Listenpreis und Status (aktiv/inaktiv) pflegen, damit ich Preishistorie und Preisänderungen dokumentieren kann.
- Als Nutzer möchte ich beim Hinzufügen eines neuen Preises den alten automatisch auf „inaktiv" setzen können, damit nur ein aktiver Preis pro Produkt gilt.
- Als Nutzer möchte ich in der Preis-Liste erkennen, welcher Preis aktuell gültig ist (heute zwischen Gültig-ab und optional Gültig-bis).
- Als Nutzer möchte ich einen Preis nachträglich bearbeiten, falls ich einen Tippfehler gemacht habe.
- Als Nutzer möchte ich einen Preis löschen, falls er fälschlich angelegt wurde.

## Acceptance Criteria
- [ ] In der Produkt-Detailseite gibt es einen Bereich „Preise" mit Tabelle: Nr., gültig ab, EK, Listenpreis, Status
- [ ] Button „+ neuer Preis" öffnet Inline-Formular mit Feldern: Gültig ab (Datum, Default: heute), EK (optional), Listenpreis (Pflicht), Status (aktiv/inaktiv)
- [ ] Beim Speichern wird der aktuell aktive Preis des Produkts automatisch auf „inaktiv" gesetzt (nur wenn neuer Preis „aktiv" ist und Datum ≤ heute)
- [ ] Nur der neueste aktive Preis (max. Gültig-ab ≤ heute mit Status aktiv) wird als „aktueller Preis" markiert
- [ ] Preise werden chronologisch absteigend sortiert (neueste zuerst)
- [ ] Listenpreis und EK als Währungs-Feld (EUR, 2 Nachkommastellen)
- [ ] Löschen mit Bestätigungsdialog
- [ ] Preise werden in PDF-Export (PROJ-9/10) als aktueller Listenpreis übernommen

## Edge Cases
- Was passiert bei zwei Preisen mit gleichem Gültig-ab-Datum? → Erlaubt, letzter angelegter gewinnt (per `created_at`)
- Was passiert, wenn kein Preis existiert? → PDF-Export zeigt „—" oder „auf Anfrage"
- Was passiert, wenn Listenpreis leer ist? → Validierungsfehler (Pflichtfeld)
- Was passiert bei negativem Preis? → Validierungsfehler
- Was passiert, wenn EK > Listenpreis? → Warnung, aber kein Block
- Was passiert beim Löschen des aktuell aktiven Preises? → Der nächst-ältere aktive Preis wird neuer „aktueller Preis"

## Technical Requirements
- Preise in eigener Tabelle `preise` mit FK `produkt_id`
- Berechnung „aktueller Preis" als SQL-View oder Query
- shadcn/ui: Table, DatePicker, Input (Currency)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure
```
Tab "Preise" innerhalb /produkte/[id]
+-- PreiseTable (sortiert nach gueltig_ab DESC)
|   +-- Badge "Aktueller Preis" auf dem neuesten aktiven
|   +-- Spalten: Gültig ab, EK, Listenpreis, Status, Aktionen
+-- "+ neuer Preis"-Button -> InlineForm oder Dialog
+-- EditPreis-Dialog (bei Klick auf Zeile)
```

### Data Model
Tabelle `preise` aus PROJ-2 mit `produkt_id`, `gueltig_ab`, `listenpreis`, `ek`, `status`. Zusätzlich **SQL-View `aktuelle_preise`**, die pro Produkt genau den aktuell gültigen Preis liefert (neueste gueltig_ab ≤ heute mit status = aktiv).

### Tech-Entscheidungen
- **Eigene Tabelle statt JSON-Array in `produkte`**: erlaubt saubere History, Sortierung, Filter und Joins im Katalog-Export.
- **View `aktuelle_preise`**: vereinfacht PDF-Export-Queries (ein Join statt Unterabfrage).
- **„Aktueller Preis" berechnet, nicht redundant gespeichert**: verhindert Inkonsistenzen.
- **Automatisches Inaktivieren**: Beim Speichern eines neuen aktiven Preises läuft eine Server Action, die alte aktive Preise auf „inaktiv" setzt.
- **Currency-Input mit 2 Nachkommastellen** über `react-number-format`.

### Abhängigkeiten
- `react-number-format` — Währungsformatierung

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
