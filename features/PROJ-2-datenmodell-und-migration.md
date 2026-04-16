# PROJ-2: Datenmodell & FileMaker-XML-Migration

## Status: Architected
**Created:** 2026-04-16
**Last Updated:** 2026-04-16

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — für RLS-Policies auf allen Tabellen

## User Stories
- Als Entwickler möchte ich ein sauberes relationales Datenmodell in Supabase haben, damit alle Folge-Features darauf aufbauen können.
- Als interner Nutzer möchte ich, dass alle bestehenden Daten aus der FileMaker-Datenbank (Bereiche, Kategorien, Produkte, Preise, Filialen, Bilder) in die neue Web-App übernommen werden, damit ich nicht bei null anfangen muss.
- Als Nutzer möchte ich Bilder (Produktfotos, Bereichsbilder, Galerien) automatisch migriert haben, damit Datenblätter sofort nach dem Launch komplett sind.
- Als Nutzer möchte ich nach der Migration sofort erkennen, welche Produkte „unvollständig" migriert sind (z.B. fehlende Felder), damit ich sie nachpflegen kann.

## Acceptance Criteria
- [ ] Supabase-Schema angelegt mit Tabellen: `bereiche`, `kategorien`, `produkte`, `preise`, `filialen`, `katalog_einstellungen`, `produkt_bilder`, `icons` (Werte-/Lookup-Tabellen wo sinnvoll)
- [ ] Alle Tabellen haben `id` (UUID), `created_at`, `updated_at`, `created_by`, `updated_by`
- [ ] Row Level Security (RLS) aktiv auf allen Tabellen, Zugriff nur für authentifizierte Nutzer
- [ ] Fremdschlüsselbeziehungen: Kategorien → Bereiche, Produkte → Kategorien, Preise → Produkte
- [ ] Import-Skript liest `daten/Lichtengross Produktkatalog_fmp12.xml` und schreibt in Supabase
- [ ] Binärbilder aus dem XML werden in Supabase Storage abgelegt, URLs in den Produkt-/Bereich-/Kategorie-Records gespeichert
- [ ] Import ist idempotent: zweimaliges Ausführen führt nicht zu Duplikaten
- [ ] Nach Migration steht ein Abgleichbericht zur Verfügung (Anzahl importiert pro Tabelle, Fehler/Warnungen)
- [ ] Alle 20 Bereiche, alle Kategorien und alle Produkte aus der XML sind in Supabase sichtbar
- [ ] Preisdaten mit Gültigkeitsdatum und Status (aktiv/inaktiv) übernommen
- [ ] Filialdaten (Marling, Klausen, Bruneck, Vomp, CH) übernommen

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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
