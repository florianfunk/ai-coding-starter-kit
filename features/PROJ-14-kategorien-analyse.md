# PROJ-14: Kategorien-Analyse & Inline-Bearbeitung

## Status: In Progress
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Dependencies
- Requires: PROJ-2 (EÜR-Kontenrahmen) — Zielsystematik
- Requires: PROJ-4 (Kontoauszug-Import) — Buchungen
- Requires: PROJ-5 (Autonome Klassifizierung) — die zu prüfenden Klassifikationen

## Beschreibung
Audit-Sicht **von der Kategorie aus** (komplementär zur Prüfliste, die von
der Buchung aus geht). Der Inhaber sieht auf einen Blick, wie viele
Buchungen je EÜR-Kategorie liegen, welche Summen sich daraus ergeben und
mit welcher Konfidenz die KI zugeordnet hat. Aus der Kategorie heraus kann
er gezielt einzelne Buchungen umkategorisieren oder als „manuell bestätigt"
markieren — Inline, ohne Sheet-Öffnen.

## User Stories
- Als Inhaber möchte ich eine Übersicht aller EÜR-Kategorien mit Anzahl Buchungen, Gesamtsumme und durchschnittlicher Konfidenz sehen, damit ich erkenne, wo der Agent fleißig war und wo ich prüfen muss.
- Als Inhaber möchte ich eine Kategorie aufklappen und die enthaltenen Buchungen sehen, damit ich die Zuordnung schnell überprüfen kann.
- Als Inhaber möchte ich in der Liste eine Buchung direkt umkategorisieren (Dropdown-Inline), damit ich Korrekturen ohne Klicks mache.
- Als Inhaber möchte ich eine Buchung als „manuell bestätigt" markieren, damit sie nicht erneut von der Re-Klassifizierung überschrieben wird.
- Als Inhaber möchte ich nach Wirtschaftsjahr und Konto filtern, damit ich gezielt einzelne Perioden auswerten kann.

## Acceptance Criteria
- [ ] Neuer Menüpunkt „Kategorien-Analyse" in der Sidebar-Sektion „Arbeit"
- [ ] Seite `/kategorien-analyse` (auth-geschützt) listet alle Kategorien mit Daten in einer Tabelle
- [ ] Pro Kategorie: Bezeichnung, Typ, USt-Satz, Anzahl Buchungen, Summe (€), Ø-Konfidenz, Status-Mix-Übersicht (auto/Prüfung/manuell)
- [ ] Filter: Wirtschaftsjahr / „Alle Jahre", Konto / „Alle Konten"
- [ ] „Keine Kategorie zugewiesen"-Zeile sichtbar (Buchungen ohne `kategorie_id`)
- [ ] Klick auf Kategorie öffnet Drill-Down mit allen Buchungen (Datum, Empfänger, Zweck, Betrag, Konfidenz, Status)
- [ ] Inline-Edit: Kategorie über Dropdown ändern, Klassifikation toggeln, „Bestätigen"-Button (→ status=manuell_bestaetigt)
- [ ] PATCH-API speichert Änderung serverseitig, Audit-Eintrag wird angelegt
- [ ] Manuell bestätigte Buchungen werden bei künftiger Re-Klassifizierung übersprungen (Verhalten existiert bereits in PROJ-5-Pipeline)
- [ ] Keine privaten/neutralen Posten in „Steuerrelevante Auswertungen" — Filter „Nur steuerrelevant" als Option

## Edge Cases
- Was passiert mit Buchungen ohne `kategorie_id`? (eigene Zeile „— ohne Kategorie —", Drill-Down zeigt sie als bearbeitbar)
- Was passiert, wenn der Nutzer die Kategorie auf einen anderen Typ ändert (privat → geschäftlich)? (Klassifikation + Steuerrelevanz automatisch anpassen, neu validieren)
- Was passiert beim Inline-Edit während ein Klassifizierungs-Job läuft? (Edit klappt, betrifft nur diese Buchung; künftige Re-Läufe respektieren `manuell_bestaetigt`)
- Wie wird angezeigt, wenn eine Kategorie 0 Buchungen hat? (auf Wunsch ausblendbar via Filter „nur belegt")
- Hochbetrag-Buchungen mit niedriger Konfidenz in einer Kategorie → optisch hervorheben (Warnsymbol)

## Technical Requirements
- Performance: Eine effiziente Aggregation (Gruppierung in der DB statt clientseitig), Tabelle paginierbar
- Sicherheit: PATCH-API mit Zod-Validierung; nur eigene Buchungen
- Nachvollziehbarkeit: jede manuelle Änderung erzeugt audit_eintrag (Quelle „nutzer")

---

## Tech Design

### Backend-Bedarf: Ja
Aggregation + PATCH-Endpunkt für Inline-Edit.

### Datenmodell
Keine Schema-Änderung nötig — alle benötigten Spalten existieren in
`buchung` und `kategorie`. Audit-Eintrag in `audit_eintrag`.

### Komponentenstruktur
```
Kategorien-Analyse (/kategorien-analyse)
+-- Filter (Jahr-Select, Konto-Select, "nur steuerrelevant"-Toggle)
+-- Übersichts-Tabelle (Kategorie · Typ · USt · Anzahl · Summe · ⌀Konf · Status-Mix)
+-- Drill-Down (Sheet pro Kategorie):
    +-- Buchungs-Liste mit Inline-Edit (Kategorie-Dropdown, "Bestätigen"-Button)
```

### API
- `GET /api/kategorien-analyse?jahr=&konto=&nur_steuerrelevant=` → Aggregat je Kategorie
- `GET /api/kategorien-analyse/buchungen?kategorie_id=&jahr=&konto=` → Drill-Down-Liste
- `PATCH /api/buchungen/[id]` → Inline-Edit: kategorie_id, klassifikation, status (z.B. „manuell_bestaetigt")

### Abhängigkeiten (Pakete)
Keine neuen.

## Implementierungsnotizen
_Wird beim Bauen ergänzt._

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
