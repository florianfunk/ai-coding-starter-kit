# PROJ-43: Mediathek (zentrale Bild-Bibliothek)

**Status:** Planned
**Priorität:** P1
**Erstellt:** 2026-04-30

## Vision
Eine WordPress-ähnliche zentrale Mediathek über alle Bilder im Storage, damit Pfleger:
- nicht mehrfach das gleiche Bild hochladen müssen,
- Bilder schnell zwischen Produkten/Kategorien/Bereichen wiederverwenden können,
- den Überblick behalten, welche Bilder aktiv im Einsatz sind und welche verwaist herumliegen.

## User Stories

- **Als Pfleger** möchte ich auf einer Mediathek-Seite alle hochgeladenen Bilder sehen, mit Filtern (verwendet/unbenutzt, Bucket, Datei-Format), damit ich den Bildbestand verwalten kann.
- **Als Pfleger** möchte ich beim Bearbeiten eines Slots/Hauptbilds/Galerie-Bilds zwischen „Datei auswählen" (Upload) und „Aus Mediathek wählen" wählen können, damit ich Bilder von einem Produkt aufs nächste übertragen kann ohne neuen Upload.
- **Als Pfleger** möchte ich pro Bild sehen, **wo es aktuell verwendet wird** (Liste aller Verweise auf das Bild), damit ich nicht versehentlich aktive Bilder lösche.
- **Als Pfleger** möchte ich Bilder in der Mediathek tagen / mit Notizen versehen, damit Suche/Wiederfinden einfacher wird.

## Acceptance Criteria

### Übersichtsseite `/mediathek`
- [ ] Grid mit allen Bildern aus Bucket `produktbilder` (paginiert / virtualisiert)
- [ ] Filter:
  - Verwendung: alle / verwendet / unbenutzt
  - Datei-Format: JPG / PNG / WebP
  - Pfad-Präfix (z.B. `kategorien/`, `produkte/`, `ai-…`)
  - Volltext-Suche im Pfadnamen
- [ ] Sortierung: hochgeladen (neueste/älteste), Größe, Pfad
- [ ] Bild-Detail beim Klick: Vorschau groß, Metadaten (Pfad, Größe, Format, Hochladedatum), **Verwendungs-Liste** (alle Records, die auf den Pfad zeigen)
- [ ] Bulk-Aktionen: ausgewählte ungenutzte Bilder löschen
- [ ] Download-Button pro Bild (auch in der Detail-Ansicht)

### „Aus Mediathek wählen" — Picker-Dialog
- [ ] Wiederverwendbare Komponente `<MediathekPicker open onSelect={...} aspect="wide|tall|square|any" />`
- [ ] Suche + Filter wie in der Übersicht
- [ ] Klick auf Bild → schließt Dialog mit `path` → Aufrufer kann ohne Upload den Slot/Hauptbild/Galerie-Eintrag setzen
- [ ] Eingebunden in:
  - Kategorie-Bildslots (alle 4)
  - Produkt-Hauptbild
  - Produkt-Galerie / Detail-Bilder / Datenblatt-Bilder
  - Bereich-Bild

### Bild-Verwendungs-Tracking
- [ ] Helper `getBildVerwendungen(path: string): { entityType, entityId, label, slot }[]`
  - Sucht in `kategorien.bild1_path..bild4_path`
  - Sucht in `bereiche.bild_path`
  - Sucht in `produkte.hauptbild_path`, `bild_detail_*_path`, `bild_zeichnung_*_path`, `bild_energielabel_path`
  - Sucht in `produkt_galerie` (sofern vorhanden)
  - Sucht in `katalog_einstellungen.cover_*_path`, `logo_*` Felder
- [ ] Performance: ein Aufruf liefert alle Mappings; bei Bedarf indizierter Helper-View

### Optional (nice-to-have)
- [ ] Tags/Notizen pro Bild (eigene Tabelle `bild_metadata`)
- [ ] Bulk-Tagging
- [ ] „Kürzlich hochgeladen" Tab (letzte 24h / Woche)

## Technical Design

### DB
Neue Tabelle für optionale Metadaten:
```sql
create table public.bild_metadata (
  path text primary key,        -- = Storage-Pfad in 'produktbilder'
  bucket text not null default 'produktbilder',
  tags text[] default '{}',
  notiz text,
  created_at timestamptz default now()
);
```

Alternativ: keine Tabelle, sondern Storage-Listing direkt aus Supabase Storage abfragen (`supabase.storage.from('produktbilder').list()`). Das reicht für MVP — Tags/Notizen erst Phase 2.

### Code-Struktur
```
src/app/mediathek/
  page.tsx                  # Übersichtsseite
  mediathek-grid.tsx        # Client-Grid mit Filter/Suche
  bild-detail.tsx           # Detail-Sheet mit Verwendungs-Liste
  actions.ts                # Server-Actions: list, delete, getUsages
src/components/
  mediathek-picker.tsx      # Picker-Dialog für andere Forms
src/lib/
  bild-verwendung.ts        # Helper zum Verwendungs-Lookup
```

### Performance-Überlegung
Bei ~400 Produkten + Galerien können schnell 1000+ Bilder im Bucket liegen. Storage-Listing ist langsam (kein DB-Index). Lösung:
- Listing in einer `bild_metadata`-Tabelle materialisieren (Trigger bei Storage-Upload — schwer; oder Server-Action, die periodisch syncht)
- Oder: Client-side virtualisierte Liste mit lazy-load von Thumbnail-Previews

## Out of Scope (für PROJ-43 Phase 1)
- Bild-Bearbeitung in der Mediathek (nur Auswahl + Lösch + Download)
- Versionsverwaltung
- Ordner-/Folder-Struktur (flach genügt für MVP)
- Migration alter Bilder mit nachträglichem Tagging
- Storage-Limits & Cleanup-Policy

## Implementation Notes
_Wird beim Implementieren ergänzt._
