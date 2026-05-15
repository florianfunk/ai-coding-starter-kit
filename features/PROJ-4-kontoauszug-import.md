# PROJ-4: Kontoauszug-Import (Excel/CSV, Multi-Konto)

## Status: Planned
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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
