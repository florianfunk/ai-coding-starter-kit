# PROJ-4: Kategorien verwalten (CRUD)

## Status: Architected
**Created:** 2026-04-16
**Last Updated:** 2026-04-16

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-2 (Datenmodell)
- Requires: PROJ-3 (Bereiche) — Kategorien gehören zu einem Bereich

## User Stories
- Als Nutzer möchte ich innerhalb eines Bereichs alle Kategorien sehen (z.B. unter „LED STRIP" die Kategorie „60 SMD/MT"), damit ich die Struktur nachvollziehen kann.
- Als Nutzer möchte ich eine neue Kategorie anlegen und einem Bereich zuordnen, inkl. Icons (2700K, 3000K, SMD/mt, Dimmable, IP20, RoHS, CE etc.) für die Schnellanzeige.
- Als Nutzer möchte ich für jede Kategorie eine Beschreibung, ein Vorschaubild und eine Sortierung pflegen, damit der Katalog korrekt aufgebaut wird.
- Als Nutzer möchte ich Icons aus einer festen Liste per Toggle an- und abwählen, damit Konsistenz im Katalog bleibt.
- Als Nutzer möchte ich eine Kategorie löschen, solange keine Produkte darauf verweisen.

## Acceptance Criteria
- [ ] Listen-Ansicht aller Kategorien eines Bereichs, sortiert nach Sortierung
- [ ] Übersichtsseite `/kategorien` mit Bereich-Filter
- [ ] Formular mit Feldern: Name, Bereich (Dropdown), Sortierung, Beschreibung (Textarea), Vorschaubild, Icons (Multi-Select)
- [ ] Icon-Auswahl basiert auf fester Referenztabelle mit allen aus FileMaker übernommenen Icons
- [ ] Beim Öffnen der Kategorie werden alle zugeordneten Artikel als Tabelle angezeigt (wie im FileMaker-Screenshot)
- [ ] Löschen nur möglich, wenn keine Produkte zugeordnet
- [ ] Bildergalerie für Kategorie (mehrere Bilder) möglich, wie in FileMaker unter „Vorschau" sichtbar
- [ ] Button „Datenblatt" und „Katalog-Parameter" greifbar aus der Kategorie-Detailseite

## Edge Cases
- Was passiert, wenn ein Bereich gelöscht wird, der Kategorien enthält? → Durch PROJ-3 verhindert
- Was passiert beim Verschieben einer Kategorie in anderen Bereich? → Erlaubt, Produkte bleiben zugeordnet, Warnung „Produkte bleiben an Kategorie gebunden"
- Was passiert bei leerer Icon-Auswahl? → Erlaubt
- Was passiert, wenn ein neues Icon benötigt wird, das nicht in der Liste ist? → Icon-Referenzliste ist pflegbar (einfache Admin-Seite) oder im MVP fix aus Migration übernommen
- Was passiert bei vielen Kategorien (>100)? → Pagination oder Suchfeld

## Technical Requirements
- shadcn/ui: Table, Combobox/Select, Dialog, Form
- Icons aus Referenztabelle `icons` (ID, Label, Symbol/Bild)
- Detail-Ansicht < 800 ms Ladezeit

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure
```
/kategorien
+-- Bereich-Filter (Dropdown, All/1-20)
+-- KategorienTable (Name, Bereich, #Produkte, Sortierung, Icons-Preview)

/bereiche/[id]  (Detail eines Bereichs)
+-- BereichHeader
+-- KategorienListe dieses Bereichs

/kategorien/[id]/bearbeiten
+-- KategorieForm
|   +-- Name, Bereich-Dropdown, Sortierung, Beschreibung
|   +-- VorschaubildUpload
|   +-- IconMultiSelect (Toggle-Pills aus icons-Tabelle)
+-- ArtikelTable dieser Kategorie (Read-only, verlinkt auf Produkte)
```

### Data Model
Nutzt `kategorien`, `icons`, `kategorie_icons` aus PROJ-2. Eine View `kategorien_with_stats` bündelt Anzahl Produkte und zugeordnete Icons.

### Tech-Entscheidungen
- **Zwei Ansichten**: Global `/kategorien` mit Bereich-Filter, plus eingebettete Liste in Bereich-Detailseite — wiederverwendet dieselbe `KategorienTable`-Komponente.
- **Icon-Zuordnung als Pill-Toggles**: visuell klar, verwendet `Toggle`/`ToggleGroup` von shadcn.
- **Icons-Referenzliste als Admin-Read-only-View im MVP** — Icons werden über Migration einmal gefüllt, kein UI-CRUD nötig.
- **Sortier-Änderung** per Inline-Input, debounced gespeichert.

### Abhängigkeiten
- Gleiche Pakete wie PROJ-3, keine zusätzlichen

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
