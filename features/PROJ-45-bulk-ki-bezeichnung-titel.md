# PROJ-45: Bulk-KI-Vorschläge für Bezeichnung & Titel

**Status:** Deployed
**Priorität:** P1
**Erstellt:** 2026-05-03
**Last Updated:** 2026-05-03
**Deployed:** 2026-05-03 (dpl_64Jyk8g7LjddZoHufJhkzgzN7aUS, commit 83cd33b)

## Vision

PROJ-44 erlaubt Einzel-Generierung in der Produkt-Form. Für die Migration der ~400 FileMaker-Produkte (bei denen `name` oft = Artikelnummer und `datenblatt_titel` leer ist) ist das zu langsam. PROJ-45 erweitert die Produkt-Tabelle um eine **Bulk-Aktion**: Markierte Produkte → Wizard-Dialog → KI generiert Vorschläge (mit Live-Progress und Concurrency-Limit) → Pfleger reviewt und akzeptiert pro Zeile/Spalte → eine zentrale "Speichern"-Aktion.

## User Stories

- **Als Produktpfleger** möchte ich z. B. 50 Produkte markieren und in einem Rutsch KI-Vorschläge bekommen, damit ich die FileMaker-Migration in vertretbarer Zeit abschließe.
- **Als Produktpfleger** möchte ich pro Produkt sehen, was die KI vorschlägt — und einzeln entscheiden, ob ich die Bezeichnung, den Titel oder beides übernehme.
- **Als Produktpfleger** möchte ich den Lauf jederzeit abbrechen können, ohne dass bereits generierte Vorschläge verloren gehen.

## Acceptance Criteria

### Bulk-Aktion in der Produkt-Tabelle
- [x] Neuer Button in der Bulk-Action-Bar: "✨ KI-Vorschläge"
- [x] Klick öffnet einen großen Modal-Wizard mit den ausgewählten Produkten

### Wizard-Modal
- [x] Tabelle mit einer Zeile pro Produkt: Artikelnummer, aktuelle Bezeichnung, aktueller Titel, generierte Bezeichnung, generierter Titel, Status (pending/läuft/fertig/Fehler), zwei Checkboxen (Bez. übernehmen / Titel übernehmen)
- [x] Live-Progress-Bar mit "X / Y fertig"
- [x] Concurrency 3 (drei parallele LLM-Calls, sonst sequenziell durchgehen)
- [x] Pro Produkt: vor Generierung "Pending", während des Calls Loader, nach Erfolg Vorschläge anzeigen + Checkboxen aktivieren, bei Fehler Fehlermeldung in der Zeile
- [x] Default: Wenn `name` leer oder == Artikelnummer → Bezeichnung-Checkbox vorausgewählt. Wenn `datenblatt_titel` leer → Titel-Checkbox vorausgewählt.
- [x] Cancel-Button: bricht laufende Iteration ab (in-flight Calls dürfen zu Ende laufen, aber keine neuen werden gestartet)
- [x] "Übernommene speichern" am Ende: schreibt nur die mit Häkchen versehenen Felder per einer einzigen Bulk-Update-Action

### API-Route /api/ai/produkt-namen-bulk-item
- [x] POST mit Produkt-ID
- [x] Lädt Produkt + Bereich/Kategorie-Namen + technische Daten serverseitig (kein Vertrauen auf Client-Daten)
- [x] Ruft `generateProduktNamen` aus PROJ-44
- [x] Rate-Limit: gleicher Bucket wie /api/ai/produkt-namen (60 / Stunde / IP)
- [x] Rückgabe: `{ id, current: {name, datenblatt_titel}, suggested: {bezeichnung, titel} }` oder `{ id, error }`

### Bulk-Save Action
- [x] Neue Server-Action `applyBulkProduktNamen(updates: { id, name?, datenblatt_titel? }[])`
- [x] Validiert UUIDs, max 500 IDs
- [x] Update pro Produkt (kein Bulk-Update mit verschiedenen Werten in Postgres möglich, also Loop)
- [x] Audit-Log pro Update
- [x] revalidatePath("/produkte")

## Out of Scope (für PROJ-45)
- KI generiert auch andere Felder (Info-Zeile, Beschreibungstexte etc.) — das ist PROJ-39/44 vorbehalten
- Wiederaufnahme nach Browser-Refresh (State ist in-memory, das reicht)
- Pause-Resume-Funktion (nur Cancel)

## Implementation Notes

**2026-05-03 — Initiale Umsetzung**

- Neue API-Route `POST /api/ai/produkt-namen-bulk-item` (`src/app/api/ai/produkt-namen-bulk-item/route.ts`):
  - Pro Aufruf 1 Produkt — der Client iteriert mit Concurrency 3
  - Lädt Produkt + Bereich/Kategorie-Namen + alle techn. Felder server-seitig (kein Vertrauen auf Client-Daten)
  - Nutzt `generateProduktNamen()` aus PROJ-44, gleicher Provider/Modell-Lookup
  - Rate-Limit eigener Bucket: 500 / Stunde / IP (separater Map vom Einzel-Endpoint, höher als Einzel-Route weil Bulk-Use-Case)
- Neue Komponente `src/app/produkte/bulk-namen-wizard.tsx`:
  - Modal mit Tabelle (Artikelnr · Status · Bezeichnung-Cell · Titel-Cell)
  - Concurrency 3, Cancel-Flag (in-flight Calls dürfen zu Ende laufen)
  - Default-Häkchen: Bezeichnung wenn leer oder == Artikelnummer · Titel wenn leer
  - „Restliche generieren" für teilweise abgebrochene Läufe
  - Speichern via Server-Action `applyBulkProduktNamen()` in einem Rutsch
- Neue Server-Action `applyBulkProduktNamen()` in `src/app/produkte/actions.ts`:
  - Zod-Validierung (UUIDs, max 500, mindestens ein Feld pro Update)
  - Loop-Update (Postgres kann nicht in einem Bulk verschiedene Werte je Zeile)
  - Audit-Log pro Update mit Marker `ki_namen`
  - revalidatePath + dashboard-Tag
- In `produkte-table-body.tsx`:
  - Neuer Button „✨ KI-Vorschläge" in der Bulk-Action-Bar
  - `BulkNamenWizard` als Sibling gemountet, bekommt aktuelle Selektion
  - Nach Speichern: Auswahl leeren + `router.refresh()`

**Designentscheidungen:**
- Pro-Item-API statt einem großen Server-Action-Call, damit die UI Live-Progress hat und der Lauf cancelbar ist (Server Actions können nicht streamen).
- 500er Rate-Limit pro IP für die Bulk-Route. Bei einem 400-Produkt-Migrationslauf reicht das in einem Rutsch. Größer wäre möglich, aber 500 schützt noch vor versehentlichen Kosten-Runaways. Der Einzel-Endpoint bleibt bei 60 — der ist für Form-Edits gedacht.

