# PROJ-4: Kontoauszug-Import (Excel/CSV, Multi-Konto)

## Status: In Progress
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-1 (Auth & Steuerprofil) — für geschützten Zugriff

## Beschreibung
Import der Kontoauszüge per Excel/CSV-Upload für mehrere Konten: ein Geschäftskonto (Bank), ein PayPal-Konto und zwei Kreditkarten. Unterschiedliche Dateiformate/Spaltenlayouts werden über wiederverwendbare Mapping-Vorlagen pro Konto normalisiert. Liefert die Buchungs-Seite für Klassifizierung (PROJ-5) und Matching (PROJ-6).

## User Stories
- Als Inhaber möchte ich meine Konten anlegen (Bank, PayPal, Kreditkarte 1, Kreditkarte 2), damit Buchungen einem Konto zugeordnet sind.
- Als Inhaber möchte ich pro Konto eine Excel/CSV-Datei hochladen, damit die Buchungen importiert werden.
- Als Inhaber möchte ich beim ersten Import pro Konto festlegen, welche Spalte Datum/Betrag/Verwendungszweck/Empfänger ist, damit künftige Importe automatisch laufen.
- Als Inhaber möchte ich, dass das gespeicherte Mapping bei weiteren Uploads desselben Kontos wiederverwendet wird, damit ich es nicht erneut einstellen muss.
- Als Inhaber möchte ich eine Import-Vorschau sehen und Duplikate erkannt bekommen, damit ich keine Buchungen doppelt erfasse.

## Acceptance Criteria
- [ ] Konten anlegbar mit Typ (Bank/PayPal/Kreditkarte) und Bezeichnung; Mehrfach-Konten unterstützt
- [ ] Upload akzeptiert Excel (.xlsx) und CSV; gängige PayPal-/Kreditkarten-/Bank-Exportformate verarbeitbar
- [ ] Spalten-Mapping pro Konto konfigurierbar (Buchungsdatum, Betrag, Soll/Haben-Vorzeichen, Verwendungszweck, Empfänger/Auftraggeber, Währung) und als wiederverwendbare Vorlage gespeichert
- [ ] Beträge werden korrekt normalisiert (Dezimal-/Tausendertrennzeichen, Vorzeichen, Soll/Haben, Fremdwährung gekennzeichnet)
- [ ] Import-Vorschau zeigt erkannte Buchungen vor dem endgültigen Übernehmen
- [ ] Duplikaterkennung über stabilen Schlüssel (Konto + Datum + Betrag + Verwendungszweck/Hash); doppelte Zeilen werden nicht erneut importiert
- [ ] Importierte Buchungen sind einem Konto und einem Zeitraum eindeutig zugeordnet und persistiert
- [ ] Import-Protokoll: Anzahl importiert/übersprungen/fehlerhaft je Datei

## Edge Cases
- Was passiert bei überlappenden Auszügen (gleiche Buchung in zwei Dateien)? (Duplikaterkennung greift)
- Wie wird mit unbekanntem/abweichendem Spaltenlayout umgegangen? (Mapping-Anpassung erzwingen statt fehlerhaft importieren)
- Wie werden Storno-/Rückbuchungen und negative Beträge behandelt?
- Was passiert bei Fremdwährungsbuchungen (Kreditkarte/PayPal in USD)? (Kennzeichnung, Umrechnung später/Hinweis)
- Wie wird mit leeren Zeilen, Summenzeilen oder Headern in der Datei umgegangen?
- Was passiert, wenn eine Datei das falsche Konto-Mapping verwendet?

## Technical Requirements
- Robustheit: tolerantes Parsing (Trennzeichen, Encoding, Datumsformate DE)
- Datenintegrität: zuverlässige Duplikaterkennung, kein Datenverlust bei Re-Upload
- Security: hochgeladene Kontodateien geschützt gespeichert (EU-Region)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (Supabase + serverseitiger Parser)
Datei-Parsing, Duplikaterkennung und persistente Buchungen erfordern Server + DB.

### Komponentenstruktur
```
Einstellungen › Konten (/einstellungen/konten)
+-- Konto-Liste (Bank/PayPal/Kreditkarte) + anlegen
+-- Mapping-Editor je Konto (Spalte → Feld) als wiederverwendbare Vorlage

Konten › Import (/einstellungen/konten/import)
+-- Datei-Upload (xlsx/csv) + Kontoauswahl
+-- Import-Vorschau-Tabelle (erkannte Buchungen, Duplikate markiert)
+-- "Übernehmen"-Aktion + Import-Protokoll
```

### Datenmodell (Klartext)
**Bankkonto**: Typ, Bezeichnung, gespeicherte Spalten-Mapping-Vorlage. **Buchung**: Konto, Buchungsdatum, Betrag (normalisiert, Vorzeichen/Soll-Haben), Verwendungszweck, Empfänger, Währung, Duplikat-Hash, Import-Quelle. Klassifizierungsfelder werden später (PROJ-5) ergänzt.

### Tech-Entscheidungen (Begründung)
- **SheetJS (`xlsx`) + CSV-Parser im `lib/importer/`:** deckt Excel und CSV ab.
- **Mapping-Vorlage pro Konto:** Einmal konfigurieren, wiederverwenden — verschiedene Bank-/PayPal-/Kreditkartenformate.
- **Duplikat-Hash (Konto+Datum+Betrag+Zweck):** verhindert Doppelimport bei überlappenden Auszügen.
- **Vorschau vor Commit:** kein stiller Fehlimport bei falschem Mapping.

### Abhängigkeiten (Pakete)
- `xlsx` (SheetJS) — Excel-Parsing.

### Edge-Case-Behandlung
Duplikaterkennung bei Überlappung; erzwungene Mapping-Anpassung bei unbekanntem Layout; Storno/negative Beträge korrekt; Fremdwährung gekennzeichnet; Header/Summen-/Leerzeilen gefiltert; Warnung bei falschem Konto-Mapping.

## Implementierungsnotizen

**Implementiert am:** 2026-05-15 · Branch `feat/steueragent-mvp` (kein Commit/Branch im Auftrag)

### Erstellte Dateien
- `src/lib/importer/parser.ts` — reine, testbare Parsing-/Normalisierungslogik:
  - `leseMatrix` (xlsx + csv via `XLSX.read`, SheetJS erkennt CSV automatisch)
  - `normalisiereBetrag` (DE `1.234,56` / EN / Klammern / Soll-Haben / invertieren)
  - `normalisiereDatum` (TT.MM.JJJJ, T.M.JJJJ, 2-stelliges Jahr, /-., ISO, Excel-Serienzahl → ISO)
  - `bildeDuplikatHash` (FNV-1a 64-bit aus `konto_id|datum|betrag(2 NK)|zweck normalisiert`, ohne externe Abhängigkeit)
  - `parseKontoauszug` (Header-Erkennung, Leer-/Summenzeilen-Filter, Mapping-Anwendung, Fehlerzeilen ohne Abbruch)
- `src/lib/importer/parser.test.ts` — 27 Vitest-Tests (Betrag DE/EN/negativ/Soll-Haben/invertieren, Datum, Hash-Stabilität, Header/Leer/Summen-Filter, falsches Mapping)
- `src/lib/validation/konto.ts` + `konto.test.ts` — Zod-Schemas (Konto-Anlage, Mapping, Import-Request), 10 Tests
- `src/app/api/konten/route.ts` (GET-Liste owner-scoped `.limit(100)`, POST), `src/app/api/konten/[id]/route.ts` (PUT, DELETE)
- `src/app/api/konten/import/route.ts` (POST FormData, `?preview`/`preview=1`, Duplikaterkennung gegen `buchung.duplikat_hash`, `job_lauf` art=`konto_import`, Protokoll `{importiert, uebersprungen, fehlerhaft}`)
- `src/app/(app)/einstellungen/konten/page.tsx` + `src/components/konten/konten-tabelle.tsx` + `konto-dialog.tsx` (Mapping-Editor im Dialog integriert)
- `src/app/(app)/einstellungen/konten/import/page.tsx` + `src/components/konten/import-panel.tsx` (Upload, Vorschau mit Duplikatmarkierung, Übernehmen, Protokoll)
- `src/app/(app)/buchungen/page.tsx` + `src/components/buchungen/buchungen-ansicht.tsx` (Server Component lädt, Client filtert nach Konto/Zeitraum via URL-Params, `.limit(500)`)

### Designentscheidungen / Abweichungen
- Mapping-Editor wurde in den Konto-Dialog integriert (statt separater Editor-Komponente) — eine Maske für Stammdaten + Vorlage, weniger Klicks. Acceptance-Kriterium (Mapping pro Konto, wiederverwendbar) bleibt erfüllt.
- Duplikat-Hash: eigener FNV-1a statt Crypto-Abhängigkeit (Vorgabe: keine neuen Pakete; reine Funktion). Stabil gegen Whitespace/Groß-Klein im Zweck.
- Import nutzt `upsert(onConflict: owner_id,duplikat_hash, ignoreDuplicates)` als zweite Verteidigungslinie gegen Race-Conditions bei überlappenden Auszügen; das DB-Unique-Constraint bleibt maßgeblich.
- DELETE eines Kontos ist Hard-Delete (Buchungen via `ON DELETE CASCADE`), mit deutlicher Bestätigungswarnung im UI. Bewusste Abweichung vom Soft-Delete des Kontenrahmens, da Konten keine historische Referenz wie Kategorien benötigen.
- Klassifizierungsfelder (`klassifikation`, `kategorie_id`, `status` etc.) bleiben beim Import leer/Default `offen` — wird von PROJ-5 gefüllt. Buchungsliste zeigt diese Spalten an, „—“ wenn leer.
- Fremdwährung: `waehrung` wird übernommen/normalisiert (Default EUR), in Vorschau und Buchungsliste gekennzeichnet; Umrechnung später (außerhalb Scope).

### Status Tooling
- `npx tsc --noEmit`: fehlerfrei
- `npx eslint` (alle PROJ-4-Pfade inkl. Tests): keine Fehler/Warnungen
- Unit-Tests: 37 neue Tests grün (27 parser + 10 konto); Gesamtsuite 115/115 grün, keine Regression
- Migration `0001_init_steueragent.sql` NICHT geändert (Tabellen `konto`/`buchung`/`job_lauf` wie vorgegeben verwendet)

### Offene Punkte / Folgefeatures
- E2E-Tests (Playwright) für den Upload-Flow nicht erstellt (nicht beauftragt; `/qa` übernimmt).
- Geschützte Storage-Ablage der Originaldatei: Datei wird derzeit nur transient geparst, nicht im Supabase Storage abgelegt. Falls Aufbewahrung der Quelldatei gefordert ist, in PROJ-4-Erweiterung/`/qa` adressieren.
- Klassifizierung der importierten Buchungen erfolgt in PROJ-5.

## QA Test Results

**Stand:** Approved (2026-05-15) — automatisierte QA grün.

- `npx tsc --noEmit`: fehlerfrei (projektweit)
- `npx eslint src`: 0 Fehler (1 unkritische Warnung in vendor-Datei `use-toast.ts`)
- Unit-Tests: gesamte Suite 307/307 grün
- `next build`: erfolgreich, alle 40 Routen kompilieren
- Acceptance Criteria gegen Implementierung geprüft (siehe Implementierungsnotizen)

Offen für manuelle/E2E-QA mit echten Daten: visuelle Prüfung, End-to-End-Flows mit echter Paperless-Instanz und realen Kontoauszügen.

## Deployment
_To be added by /deploy_
