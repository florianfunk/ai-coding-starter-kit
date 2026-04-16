# PROJ-7: Suche & Filter

## Status: Architected
**Created:** 2026-04-16
**Last Updated:** 2026-04-16

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-5 (Produkte)

## User Stories
- Als Nutzer möchte ich global nach Produkten suchen (Artikelnummer, Name, Beschreibung), damit ich schnell ein bestimmtes Produkt finde.
- Als Nutzer möchte ich die Produktliste nach Bereich und Kategorie filtern, damit ich mich auf einen Produktbereich konzentrieren kann.
- Als Nutzer möchte ich mit einem Klick die „unbearbeiteten Produkte" (Flag „Artikel bearbeitet" = false) anzeigen lassen, damit ich weiß, was noch gepflegt werden muss.
- Als Nutzer möchte ich das Suchergebnis nach Artikelnummer, Name, letzter Änderung oder Sortierung sortieren.
- Als Nutzer möchte ich im Kopfbereich ein Suchfeld haben (wie in FileMaker), das von jeder Seite aus erreichbar ist.

## Acceptance Criteria
- [ ] Globales Suchfeld im Header-Menü, durchsucht Artikelnummer, Name, Beschreibung
- [ ] Suche unterstützt Teil-Treffer und ist case-insensitive
- [ ] Filter-Leiste in Produktliste: Bereich (Dropdown), Kategorie (abhängig), Status bearbeitet/unbearbeitet, Freitext
- [ ] Button „Unbearbeitete Produkte" springt direkt zur gefilterten Liste (Flag = false)
- [ ] Sortieroptionen: Artikelnummer ↑↓, Name ↑↓, Letzte Änderung ↑↓, Sortierfeld ↑↓
- [ ] Filter- und Sortier-Status in der URL kodiert (Shareable Link)
- [ ] Ergebnisanzahl sichtbar („X Produkte gefunden")
- [ ] Pagination bei > 50 Treffern (Default 50 pro Seite)

## Edge Cases
- Was passiert bei leerer Suche? → Alle Produkte (gefiltert nach Filterleiste)
- Was passiert bei 0 Treffern? → Leer-Zustand mit Hinweis „Keine Produkte gefunden" + Reset-Button
- Was passiert bei Suche mit Sonderzeichen (z.B. `/`, `-`)? → Korrekt behandelt (Artikelnummern enthalten `-`)
- Was passiert bei sehr langen Suchbegriffen (>100 Zeichen)? → Truncated, gibt 0 Treffer, kein Fehler
- Was passiert bei Umlauten (ä, ö, ü)? → Unicode-tolerant, findet sowohl „LEUCHTMITTEL" als auch „Leuchtmittel"

## Technical Requirements
- Supabase Full-Text-Search oder ILIKE für MVP
- Suche < 300 ms bei <1000 Produkten
- Debounce 250 ms bei Eingabe
- shadcn/ui: Input, Combobox, Pagination

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure
```
AppShell TopBar
+-- GlobalSearchInput (durchsucht Artikelnummer/Name/Beschreibung, Command-Palette-Stil)
    +-- Ergebnisse: bis zu 10 Top-Treffer mit Deep-Link
    +-- "Alle X Ergebnisse anzeigen" -> /produkte?q=...

/produkte
+-- FilterBar
|   +-- Freitext
|   +-- Bereich-Combobox
|   +-- Kategorie-Combobox (abhängig vom Bereich)
|   +-- Status-Toggle (alle / nur unbearbeitet)
|   +-- Sortierung-Dropdown
+-- ProdukteTable (mit Pagination)
+-- ResultCount
```

### Data Model
Zusätzlich zu `produkte` wird eine **Postgres Full-Text-Search-Spalte `search_vector` (tsvector)** mit deutschem Wörterbuch indexiert. GIN-Index darauf. Artikelnummern werden zusätzlich per `ILIKE` getrimmt gematcht (Bindestriche sind FTS-unfreundlich).

### Tech-Entscheidungen
- **Postgres Full-Text-Search statt externer Search-Service**: bei <1000 Produkten performant genug, keine zusätzliche Infrastruktur.
- **URL-basierte Filter-State**: `?q=...&bereich=...&kategorie=...` — macht Links teilbar und Browser-Back funktioniert.
- **Command-Palette (`cmdk`)** für globale Suche, Standard-Shortcut `⌘K`.
- **Debounced 250 ms** bei Tippeingabe.
- **Pagination via URL-Offset** (server-seitig), keine Infinite-Scroll im MVP.

### Abhängigkeiten
- `cmdk` — Command Palette (oder via shadcn/ui `Command`-Komponente)
- `nuqs` — URL-State-Binding (vereinfachen Filter-Querys)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
