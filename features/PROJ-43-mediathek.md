# PROJ-43: Mediathek (zentrale Bild-Bibliothek)

**Status:** Approved
**Priorität:** P1
**Erstellt:** 2026-04-30
**Last Updated:** 2026-04-30

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

**Implementiert am 2026-04-30 (Phase 1 + Phase 2):**

### Gelieferte Komponenten
- `src/lib/bild-verwendung.ts` — Verwendungs-Lookup quer durch Bereiche, Kategorien, Produkte, Katalog-Einstellungen; Single-Path und Batch-Variante
- `src/app/mediathek/actions.ts` — Server-Actions: `listMediathek`, `getMediathekSignedUrl`, `getMediathekUsages`, `deleteMediathekBild`
- `src/app/mediathek/page.tsx` — Übersichtsseite mit Summary-Strip (Total/Used/Unused/Größe)
- `src/app/mediathek/mediathek-grid.tsx` — Client-Grid mit Suche/Filter (Verwendung/Ordner/Format), Detail-Sheet (Verwendungs-Liste mit Edit-Links), Lösch-Bestätigung mit Force-Modus
- `src/components/mediathek-picker.tsx` — Wiederverwendbarer Picker-Dialog für andere Forms; Trigger-Variante "icon" (für Slot-Action-Bars) + "default" (Standalone-Button)
- Sidebar-Link „Mediathek" in der Assets-Gruppe (Library-Icon)
- Eingebunden in alle 4 Kategorie-Bildslots: zwischen Upload und Zoom-Button

### Architektur-Entscheidungen
- **Storage-Listing live, kein DB-Mirror.** Supabase Storage `list()` wird beim Page-Load + Filter-Refresh aufgerufen; Verwendungs-Counts via Batch-Lookup über alle Path-Spalten in einer Query-Runde. Bei ~1000 Bildern noch performant.
- **Subfolder-Recursion manuell.** Storage `list()` returned Files + Subfolder-Entries als Mix. Wir machen pro Subfolder einen weiteren Listing-Call (parallel) — das deckt unsere übersichtliche Ordner-Struktur (`kategorien/`, `produkte/`, `ai-…`) ab.
- **Verwendungs-Lookup ohne DB-View.** Wir scannen on-demand alle Path-Spalten direkt; das vermeidet Migrations-Aufwand und hält die Logik in TypeScript pflegbar.
- **Kein Bild-Metadata-Table in Phase 1.** Tags/Notizen sind Out-of-Scope — würden eine eigene Tabelle erfordern und sind nicht akut wichtig.
- **Lösch-Schutz mit Force-Override.** `deleteMediathekBild` blockiert standardmäßig, wenn Verwendungen existieren. Der UI-Dialog zeigt die Verwendungen und bietet „Trotzdem löschen" — der Pfleger kann bewusst entscheiden.

### Bekannte Limitierungen
- Listing auf 100 Items begrenzt (PAGE_SIZE in actions.ts) — bei großen Beständen müsste Pagination/Virtualisierung folgen
- Beim „Trotzdem löschen" werden referenzierende Records nicht automatisch nullified — sie behalten den toten Pfad in der DB. Folge: `<Image>` zeigt ein „Bild fehlt"-Symbol. Cleanup-Aktion oder Validierung im Catch wäre Phase 2.
- Picker zeigt aktuell **alle** Bilder unabhängig vom Slot-Aspect; `preferAspect`-Prop ist vorhanden, aber noch nicht zum Sortieren/Filtern genutzt
- Nur Kategorie-Slots haben den Picker — Bereiche, Produkte (Hauptbild, Galerie, Datenblatt-Bilder) folgen in einer späteren Phase
