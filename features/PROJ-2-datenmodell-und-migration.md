# PROJ-2: Datenmodell & FileMaker-Data-API-Migration

## Status: Approved
**Created:** 2026-04-16
**Last Updated:** 2026-04-17

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — für RLS-Policies auf allen Tabellen

## User Stories
- Als Entwickler möchte ich ein sauberes relationales Datenmodell in Supabase haben, damit alle Folge-Features darauf aufbauen können.
- Als interner Nutzer möchte ich, dass alle bestehenden Daten aus der FileMaker-Datenbank (Bereiche, Kategorien, Produkte, Preise, Filialen, Bilder) in die neue Web-App übernommen werden, damit ich nicht bei null anfangen muss.
- Als Nutzer möchte ich Bilder (Produktfotos, Bereichsbilder, Galerien) automatisch migriert haben, damit Datenblätter sofort nach dem Launch komplett sind.
- Als Nutzer möchte ich nach der Migration sofort erkennen, welche Produkte „unvollständig" migriert sind (z.B. fehlende Felder), damit ich sie nachpflegen kann.

## Acceptance Criteria
- [x] Supabase-Schema angelegt mit Tabellen: `bereiche`, `kategorien`, `produkte`, `preise`, `filialen`, `katalog_einstellungen`, `produkt_bilder`, `icons`, `farbfelder`, `katalog_seiten` (Werte-/Lookup-Tabellen wo sinnvoll)
- [x] Alle Tabellen haben `id` (UUID), `created_at`, `updated_at`, `created_by`, `updated_by`
- [x] Row Level Security (RLS) aktiv auf allen Tabellen, Zugriff nur für authentifizierte Nutzer
- [x] Fremdschlüsselbeziehungen: Kategorien → Bereiche, Produkte → Kategorien, Preise → Produkte
- [x] Import-Skript liest über **FileMaker Data API** (statt XML) und schreibt in Supabase (`scripts/migrate-from-dataapi.ts`)
- [x] Container-Bilder werden via Data API heruntergeladen und in Supabase Storage hochgeladen, Pfade in den Records gespeichert
- [x] Import ist idempotent: zweimaliges Ausführen aktualisiert via `ON CONFLICT (external_id) DO UPDATE`
- [x] Nach Migration steht ein Abgleichbericht zur Verfügung (`scripts/migrate-dataapi-report.json`)
- [x] Alle 20 Bereiche, 80 Kategorien, 419 Produkte aus FileMaker sind in Supabase
- [x] 1.449 Preisdatensätze mit Gültigkeitsdatum und Status (aktiv/inaktiv) übernommen
- [ ] Filialdaten (Marling, Klausen, Bruneck, Vomp, CH) — noch nicht in FM-Tabellen vorhanden, manuell nachpflegen

## Edge Cases
- Was passiert, wenn ein Produkt auf eine nicht existierende Kategorie verweist? → In Import-Log als Warnung, Produkt bleibt mit NULL-Kategorie erhalten
- Was passiert bei fehlenden Pflichtfeldern im XML? → Default-Werte setzen und in Bericht auflisten
- Was passiert mit Binärbildern ohne Dateiendung? → MIME-Type erkennen oder als `.bin` speichern, Warnung loggen
- Was passiert bei doppelten Artikelnummern? → Import-Fehler, manueller Eingriff nötig, im Bericht markieren
- Was passiert, wenn der Import abbricht (z.B. Netzwerkfehler)? → Transaktion zurückrollen oder bei Re-Run dort weiter, wo abgebrochen wurde
- Was passiert mit Sonderzeichen/Umlauten (UTF-16-XML)? → Korrekte Dekodierung sicherstellen

## Technical Requirements
- Datenbank: Supabase (PostgreSQL)
- Import-Skript als Node.js/TypeScript-Script unter `scripts/migrate-filemaker.ts`
- Bilder werden in Supabase Storage Bucket `produktbilder` (public read für eingeloggte Nutzer) gespeichert
- Referenzielle Integrität per FK-Constraints
- Indizes auf: `produkte.artikelnummer`, `produkte.kategorie_id`, `kategorien.bereich_id`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Data Model (relationales Schema in Klartext)

**Tabelle `bereiche`** (20 Einträge)
- ID, Name, Beschreibung, Sortierung, Seitenzahl, Startseite, Endseite (berechnet), Bild-URL
- Audit: created_at, updated_at, created_by, updated_by

**Tabelle `kategorien`** (~70 Einträge)
- ID, bereich_id (FK → bereiche), Name, Beschreibung, Sortierung, Vorschaubild-URL
- Icon-Zuordnung über Zwischentabelle `kategorie_icons`

**Tabelle `icons`** (Referenzliste, aus FileMaker übernommen)
- ID, Label (z.B. „2700K", „IP20", „Dimmable"), Symbol-URL

**Tabelle `kategorie_icons`** (n:m zwischen Kategorien und Icons)
- kategorie_id, icon_id

**Tabelle `produkte`** (~400+ Einträge)
- ID, kategorie_id (FK), bereich_id (redundant für Performance), Artikelnummer (unique), Sortierung
- Flag „artikel_bearbeitet" (bool)
- Alle technischen Felder (elektrisch, lichttechnisch, mechanisch, thermisch, sonstiges) — flach als Spalten, weil Struktur fix und gut bekannt ist
- Datenblatt-Titel, Datenblatt-Text (Markdown), Hauptbild-URL
- Audit

**Tabelle `produkt_bilder`** (Galeriebilder)
- ID, produkt_id (FK), url, sortierung, alt_text

**Tabelle `produkt_icons`** (n:m Produkt ↔ Icons für die Icon-Leiste im Datenblatt)
- produkt_id, icon_id

**Tabelle `preise`**
- ID, produkt_id (FK), gueltig_ab, listenpreis, ek, status (aktiv/inaktiv)

**Tabelle `filialen`**
- ID, marke (lichtengros/eisenkeil), name, land, adresse, telefon, fax, email

**Tabelle `katalog_einstellungen`** (Singleton, nur eine Zeile)
- Copyright-Texte, Gültigkeitsdatum, Cover-Bild-URLs, Logo-URLs, Wechselkurs EUR/CHF

### Migrations-Strategie
```
XML-Datei (76k Zeilen, UTF-16)
  |
  v
Import-Skript (scripts/migrate-filemaker.ts)
  +-- Phase 1: XML parsen -> JSON-Struktur im Speicher
  +-- Phase 2: Binärbilder extrahieren -> Supabase Storage "produktbilder"
  +-- Phase 3: Tabellen befüllen in Reihenfolge:
  |   1. icons (fix)
  |   2. bereiche
  |   3. kategorien (+ kategorie_icons)
  |   4. produkte (+ produkt_bilder + produkt_icons)
  |   5. preise
  |   6. filialen
  |   7. katalog_einstellungen
  +-- Phase 4: Abgleichbericht -> scripts/migrate-report.json
```

Idempotenz: Alle Inserts nutzen `ON CONFLICT (external_id) DO UPDATE`, wobei `external_id` die FileMaker-ID ist. Zweifaches Ausführen schreibt die Daten neu, erzeugt aber keine Duplikate.

### Tech-Entscheidungen
- **UUID als Primary Key**: global eindeutig, keine Kollisionen bei späterer Sync-Erweiterung.
- **Technische Produktfelder flach in `produkte`-Tabelle**, nicht als JSON: Felder sind aus FileMaker bekannt und fix, ermöglicht SQL-Filter/Sortierung und einfaches Formular-Binding.
- **RLS auf allen Tabellen**: Zugriff nur für authentifizierte Nutzer (policy `auth.uid() IS NOT NULL`).
- **Supabase Storage Bucket `produktbilder`** mit signed URLs für Bild-Auslieferung an eingeloggte Nutzer.
- **Import als One-Shot-Skript, nicht als laufender Service**: einmaliger Transfer.

### Abhängigkeiten (Pakete)
- `@supabase/supabase-js`
- `fast-xml-parser` — XML-Parsing
- `iconv-lite` — UTF-16-Dekodierung
- `dotenv` — Umgebungsvariablen im Skript
- `tsx` — TypeScript-Runner für das Skript

### Risiken & Mitigation
- **Risiko:** Binärbilder im XML sind Base64-kodiert und groß → Skript könnte in RAM laufen. **Mitigation:** Streaming-Parser oder Chunked-Processing.
- **Risiko:** FileMaker-UUIDs sind Text, Supabase-UUIDs strikt. **Mitigation:** FileMaker-ID in separater Spalte `external_id` speichern, neue UUIDs generieren.

## Implementation Notes (2026-04-17)

### Änderung gegenüber Architektur-Design
- **Data API statt XML-Import**: Die DDR-XML enthielt nur Schema-Metadaten, keine Datensätze.
  Stattdessen wurde die **FileMaker Data API** (`https://claris.sustainable.de`) angebunden.
  Container-Bilder werden per HTTP-Redirect-Flow mit Session-Token heruntergeladen.
- **Neues Skript**: `scripts/migrate-from-dataapi.ts` ersetzt das XML-basierte `scripts/migrate-filemaker.ts`.
- **Reset-Skript**: `scripts/reset-for-migration.ts` löscht alle Daten + Storage für einen sauberen Re-Import.

### Migrationsstatistik (Vollimport 2026-04-17)
| Tabelle | Records | Bilder |
|---------|---------|--------|
| Bereiche | 20 | 20 |
| Kategorien | 80 | ~80 |
| Artikel/Produkte | 419 | 1.264 (Haupt-, Detail-, Zeichnungsbilder) |
| Preise | 1.449 | — |
| Icons | 33 | 33 |
| Farbfelder | 71 | — |
| Katalogseiten | 4 | — |
| Kategorie↔Icon | 138 | — |
| Produkt↔Icon | 1.212 | — |
| System-Einstellungen | 1 (Singleton) | 6 Logos/Cover |

### Warnungen (nicht kritisch)
- 5 Produkt-Icons verweisen auf gelöschte Icons in FileMaker
- 30 Preise verweisen auf gelöschte Artikel in FileMaker — übersprungen

### Schema-Migrationen
- `0007_filemaker_import_fields.sql` — Marker, Sortierfelder, Bildpfade, Farbfelder, Katalogseiten
- `0008_farbfelder_drop_unique.sql` — Farbfeld-Code darf Duplikate haben
- `0009_artikelnummer_not_unique.sql` — Artikelnummern in FileMaker nicht eindeutig

## QA Test Results (2026-04-17)
**Verdict: PRODUCTION-READY** ✅

### Datenintegrität
- Record Counts: alle korrekt (20/80/419/1449/33/71/4)
- Referenzielle Integrität: 0 verwaiste FK
- NULL-Pflichtfelder: keine NULLs
- Duplikate external_id: keine
- RLS: alle Tabellen aktiv
- Bilder: 418/419 Produkte mit Hauptbild, 33/33 Icons

### Security Audit
- Keine Critical/High Findings
- Medium: `rejectUnauthorized: false` (lokal-only), Report aus Git entfernt
- Low: `.env.local.example` aktualisiert, Production-Guard in Reset-Skript

### Offene Info-Punkte (nicht blockierend)
- 1 Duplikat-Artikelnummer `DM1FLS-42-1050-DALI2-LD1P` (erwartet)
- 12 Produkte ohne aktiven Preis — im FM-Original prüfen
- 4 Bereiche + 1 Produkt ohne Bild — fehlendes Quellmaterial

## Deployment
_To be added by /deploy_
