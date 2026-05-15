# PROJ-11: Export (PDF, CSV/DATEV-ähnlich, ELSTER-konforme Kennzahlen)

## Status: In Progress
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

## Implementierungsnotizen

**Implementiert (feat/steueragent-mvp):**

- `src/lib/export/csv.ts` — reine Funktionen: `buchungenAlsCsv`
  (DATEV-ähnliches Schema: Datum, Betrag, Soll/Haben, Konto, Gegenkonto,
  USt-Satz, Beleg-Referenz, Buchungstext) und `elsterKennzahlenAlsCsv`
  (Feldnr → Wert). Definiertes Encoding: UTF-8-BOM, Semikolon-Trennzeichen,
  CRLF, deutsches Betragsformat (Komma, cent-gerundet), RFC-4180-Quoting.
- `src/lib/export/csv.test.ts` — 23 Vitest-Tests (Quoting für
  Trennzeichen/Quote/Zeilenumbruch, Betrag-Format inkl. Float-Artefakte,
  leere Felder als echtes Leerfeld, BOM/Encoding, Soll/Haben, ELSTER-Feldmap-
  Vollständigkeit + Eindeutigkeit der Kennzahlen, Leereingabe → nur Kopf).
- `src/lib/export/pdf.tsx` — server-only PDF-Generatoren via
  `@react-pdf/renderer` (`renderToBuffer`): EÜR-Aufstellung (WJ), USt-VA
  (Periode, inkl. ELSTER-Kennzahlen), Privatentnahmen-Aufstellung,
  reines ELSTER-Übertragungsblatt. Firmenstammdaten (PROJ-1) im Kopf,
  „vorläufig"-Wasserzeichen + roter Hinweis bei nicht abgeschlossenen
  Perioden/Jahren. Smoke-getestet (gültige `%PDF-`-Buffer).
- `src/lib/validation/export.ts` — Zod: `exportRequestSchema`
  (typ/format/jahr/periode) inkl. `superRefine` für zulässige Format-je-Typ-
  Kombinationen und Pflicht-Periode bei USt-VA/ELSTER (Zod 4).
- `src/app/api/export/route.ts` — POST/GET: erzeugt den gewählten Export.
  Ruft die reinen tax-Funktionen (`berechneEuer`/`berechneUstVa`) direkt
  auf. Abgeschlossene Perioden/Jahre → unveränderlicher
  `steuerperiode.snapshot` (deterministisch); offene → on-the-fly +
  „vorläufig". Download via Content-Disposition, Dateiname
  `Firma_Typ_Zeitraum.ext`. getApiUser→401, owner-scoped, `.limit()`.
  Datenschutz: betrieblicher Buchungs-CSV filtert private Posten heraus;
  Privatentnahmen nur im dedizierten Export.
- `src/app/api/export/status/route.ts` — leichter Abschluss-Status für die
  UI-Warnung (owner-scoped, Zod, 401).
- `src/app/(app)/export/page.tsx` + `src/components/export/export-auswahl.tsx`
  — Auswahl Typ (EÜR/USt-VA/Privatentnahmen/Buchungsexport/ELSTER) +
  Jahr/Periode + Format, „vorläufig"-Alert bei offener Periode/Jahr,
  Snapshot-Hinweis bei abgeschlossenen, Generieren + Browser-Download.
  Nur shadcn/ui (Card, Select, RadioGroup, Button, Badge, Alert, Label,
  sonner). Lade-/Fehler-/Leerzustände, responsive, Deutsch.

**Status Checks:** `npx tsc --noEmit` ✓ fehlerfrei · ESLint (alle PROJ-11-
Pfade) ✓ keine Fehler/Warnungen · `vitest run src/lib/export` ✓ 23/23.

**Deviations / Hinweise:**
- Zusätzlicher Endpunkt `api/export/status` (im erlaubten Pfad
  `src/app/api/export/**`) für die „vorläufig"-Warnung der UI ergänzt.
- Privatentnahmen werden direkt aus Buchungen abgeleitet
  (`klassifikation='privat'` ODER Kategorie-`typ='privat'`), da die
  PROJ-10-ESt-Route parallel entsteht und noch nicht existiert. Sauber
  austauschbar, sobald PROJ-10 eine Privatentnahmen-Quelle liefert.
- Offen: E2E-Tests, QA-Audit (`/qa`).

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
