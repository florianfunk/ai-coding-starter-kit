# PROJ-3: Bereiche verwalten (CRUD)

## Status: Architected
**Created:** 2026-04-16
**Last Updated:** 2026-04-16

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-2 (Datenmodell)

## User Stories
- Als Nutzer möchte ich eine Übersicht aller Bereiche (z.B. LED STRIP, ZUBEHÖR LEDSTRIP, NEON FLEX) mit Anzahl Kategorien, Anzahl Produkten, Sortierung, Seitenzahl, Start- und Endseite sehen — vergleichbar mit der FileMaker-Übersicht.
- Als Nutzer möchte ich einen neuen Bereich anlegen, um Produkte einer neuen Produktgruppe strukturieren zu können.
- Als Nutzer möchte ich einen Bereich bearbeiten (Name, Beschreibung, Bild, Sortierung, Seitenzahl, Startseite), um Änderungen am Katalog vornehmen zu können.
- Als Nutzer möchte ich einen Bereich löschen, solange keine Kategorien/Produkte darauf verweisen.
- Als Nutzer möchte ich Bereiche per Drag-and-Drop oder Sortier-Feld neu ordnen, damit die Katalogreihenfolge stimmt.

## Acceptance Criteria
- [ ] Listen-Ansicht `/bereiche` mit Spalten: Nr., Name, Anzahl Kategorien, Anzahl Produkte, Sortierung, Seitenzahl, Startseite, Endseite, Bild (Thumbnail)
- [ ] Button „+ neuer Bereich" öffnet Formular
- [ ] Formular mit Feldern: Name (Pflicht), Beschreibung, Bild-Upload, Sortierung (Nummer), Seitenzahl (Nummer), Startseite (Nummer)
- [ ] Klick auf einen Bereich öffnet Detail-/Bearbeiten-Ansicht
- [ ] Löschen-Button mit Bestätigungsdialog, nur wenn keine Kategorien zugeordnet
- [ ] Sortierung beeinflusst Reihenfolge in Liste UND später in PDF-Katalog
- [ ] Bild-Upload zu Supabase Storage, Vorschau im Formular
- [ ] Änderungen protokolliert über `updated_at` / `updated_by`

## Edge Cases
- Was passiert bei Löschversuch eines Bereichs mit Kategorien? → Dialog „X Kategorien verweisen hierauf — bitte erst verschieben/löschen"
- Was passiert bei doppeltem Namen? → Warnung, aber kein harter Block (Namen müssen nicht unique sein)
- Was passiert bei sehr großen Bildern (>10 MB)? → Automatische Komprimierung oder Fehlermeldung mit Limit-Hinweis
- Was passiert bei identischer Sortiernummer? → Sekundäre Sortierung alphabetisch nach Name
- Was passiert bei Bildern in falschem Format? → Akzeptiert: JPG, PNG, WebP; Ablehnung mit klarer Meldung

## Technical Requirements
- Listen-Ansicht < 500 ms für 20 Bereiche
- shadcn/ui Komponenten: Table, Dialog, Form, Input, Button
- Bildspeicherung: Supabase Storage
- Optimistische UI bei CRUD-Operationen

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure
```
/bereiche (Liste)
+-- PageHeader mit "+ neuer Bereich"-Button
+-- BereicheTable
|   +-- Thumbnail, Name, #Kategorien, #Produkte, Sortierung, Seitenzahl, Start/End
|   +-- Row-Actions (Bearbeiten, Löschen)
+-- Pagination (falls > 20)

/bereiche/neu
/bereiche/[id]/bearbeiten
+-- BereichForm
    +-- Name, Beschreibung, Sortierung, Seitenzahl, Startseite
    +-- BildUpload (Drag&Drop + Vorschau)
    +-- Speichern/Abbrechen
```

### Data Model
Nutzt `bereiche`-Tabelle aus PROJ-2. Zusätzlich: abgeleitete Felder (Anzahl Kategorien/Produkte, Endseite) werden per Datenbank-View `bereiche_with_stats` berechnet, damit die Liste mit einem Query alles bekommt.

### Tech-Entscheidungen
- **Server Components für Liste**: SEO-unwichtig, aber schneller TTFB, keine Client-Bundle-Kosten.
- **Server Actions für Mutationen** (neu/bearbeiten/löschen): keine eigene API-Route nötig, RLS schützt serverseitig.
- **Optimistische UI** über `useOptimistic` für Sortier-Änderungen.
- **shadcn/ui Table** mit `@tanstack/react-table` für Sortierung/Filter.
- **Bildupload via Supabase Storage signed upload URL** direkt aus dem Browser — keine Datei läuft durch unseren Server.

### Abhängigkeiten (Pakete)
- `@tanstack/react-table` — Tabellen-Utility
- `sonner` — Toast-Benachrichtigungen (bereits in shadcn-Set)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
