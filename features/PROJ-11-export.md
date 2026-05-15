# PROJ-11: Export (PDF, CSV/DATEV-ähnlich, ELSTER-konforme Kennzahlen)

## Status: Planned
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-8 (USt-Voranmeldung) — Quelle der ELSTER-USt-Kennzahlen
- Requires: PROJ-9 (Jahres-EÜR) — Quelle der EÜR-/Buchungsdaten

## Beschreibung
Stellt die erzeugten Auswertungen in weitergebbaren Formaten bereit: formatierte PDF-Aufstellungen (EÜR, USt-VA, Privatentnahmen), ein strukturierter Buchungsexport (CSV/DATEV-ähnlich) zur Weiterverarbeitung beim Steuerberater sowie ELSTER-konform aufbereitete USt-VA-Kennzahlen zum manuellen Übertragen.

## User Stories
- Als Inhaber möchte ich EÜR, USt-VA und Privatentnahmen als PDF exportieren, damit ich sie archivieren und weitergeben kann.
- Als Inhaber möchte ich alle Buchungssätze als CSV/DATEV-ähnliche Datei exportieren, damit mein Steuerberater sie in seine Software übernehmen kann.
- Als Inhaber möchte ich die USt-VA-Kennzahlen exakt nach ELSTER-Feldnummern aufbereitet exportieren, damit ich sie nur noch in ELSTER eintragen muss.
- Als Inhaber möchte ich den Exportzeitraum/-umfang wählen, damit ich gezielt Perioden weitergeben kann.
- Als Inhaber möchte ich, dass Exporte den Snapshot abgeschlossener Perioden verwenden, damit weitergegebene Zahlen stabil sind.

## Acceptance Criteria
- [ ] PDF-Export für EÜR (Jahr), USt-VA (Periode) und Privatentnahmen-Aufstellung mit Firmenstammdaten (PROJ-1) im Kopf
- [ ] CSV/DATEV-ähnlicher Export der Buchungssätze mit definierten Feldern (Datum, Betrag, Soll/Haben, Kategorie/Konto, USt-Satz, Beleg-Referenz, Gegenkonto)
- [ ] ELSTER-konformer Export der USt-VA-Kennzahlen (Feldnummer → Wert), als PDF/CSV
- [ ] Auswahl von Zeitraum/Periode/Jahr und Export-Typ vor Erzeugung
- [ ] Exporte abgeschlossener Perioden verwenden den unveränderlichen Snapshot (PROJ-8/PROJ-9); bei offenen Perioden deutlicher „vorläufig"-Vermerk
- [ ] Exportierte Dateien sind korrekt benannt (Firma, Typ, Zeitraum) und reproduzierbar
- [ ] Keine privaten Daten in betrieblichen Exporten (Privatentnahmen nur im dedizierten Export)

## Edge Cases
- Was passiert beim Export einer noch offenen/unvollständigen Periode? (Wasserzeichen/Vermerk „vorläufig, nicht abgeschlossen")
- Wie wird mit sehr großen Buchungsmengen im CSV/PDF umgegangen? (Pagination/Streaming, keine Abschneidung)
- Was passiert, wenn ELSTER-Feldnummern sich geändert haben? (Mapping als gepflegte Stammdaten, Versionshinweis)
- Wie wird Zeichen-/Encoding-Kompatibilität für DATEV-Import sichergestellt? (definiertes Encoding/Format)
- Was passiert, wenn für den Zeitraum noch keine Auswertung erzeugt wurde? (Hinweis, kein leerer Export)

## Technical Requirements
- Format-Treue: PDF formatgerecht, CSV/DATEV mit definiertem Schema & Encoding, ELSTER-Feld-Mapping aktuell
- Stabilität: Exporte abgeschlossener Perioden deterministisch aus Snapshot
- Datenschutz: strikte Trennung privater/betrieblicher Daten in Exporten

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (serverseitige Datei-Generatoren)
PDF/CSV-Erzeugung serverseitig aus Snapshots.

### Komponentenstruktur
```
Export (/export)
+-- Auswahl: Typ (EÜR/USt-VA/Privatentnahmen/Buchungsexport/ELSTER), Zeitraum/Jahr
+-- "Vorläufig"-Warnung bei nicht abgeschlossener Periode
+-- Generieren + Download
```

### Datenmodell (Klartext)
Keine neue Tabelle: liest Snapshots aus PROJ-8/9 und Buchungs-/Belegdaten. Definierte Exportschemata (PDF-Layout, CSV/DATEV-Felder, ELSTER-Feld→Wert).

### Tech-Entscheidungen (Begründung)
- **`@react-pdf/renderer` für PDF:** formatierte Aufstellungen mit Firmenkopf (PROJ-1).
- **CSV/DATEV-ähnlich mit definiertem Encoding/Schema:** importierbar in Kanzleisoftware.
- **ELSTER-Export aus Feld-Mapping (PROJ-8):** nur Übertragen nötig, keine Einreichung.
- **Exporte abgeschlossener Perioden aus Snapshot:** stabile, reproduzierbare Dateien.

### Abhängigkeiten (Pakete)
- `@react-pdf/renderer` — PDF-Generierung.

### Edge-Case-Behandlung
Offene Periode → Wasserzeichen „vorläufig"; große Mengen → Streaming/Pagination ohne Abschneidung; geänderte ELSTER-Felder → versioniertes Mapping; definiertes DATEV-Encoding; keine Auswertung vorhanden → Hinweis statt Leerexport; private Daten nur im dedizierten Privatentnahmen-Export.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
