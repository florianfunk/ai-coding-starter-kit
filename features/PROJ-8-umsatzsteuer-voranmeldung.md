# PROJ-8: Umsatzsteuer-Voranmeldung (Vorschlag)

## Status: In Progress
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-5 (Autonome Klassifizierung) — liefert kategorisierte, USt-behaftete Buchungen
- Requires: PROJ-6 (Beleg↔Buchung-Matching) — Vorsteuer nur aus belegten Eingangsbuchungen

## Beschreibung
Erzeugt für eine USt-Voranmeldungsperiode (monatlich/quartalsweise gemäß Steuerprofil PROJ-1) einen belastbaren USt-VA-Vorschlag: Umsatzsteuer aus Einnahmen je Steuersatz, abziehbare Vorsteuer aus belegten Ausgaben, resultierende Zahllast/Erstattung — aufbereitet nach ELSTER-USt-Kennzahlen.

## User Stories
- Als Inhaber möchte ich für einen wählbaren Voranmeldungszeitraum eine USt-VA-Berechnung als Vorschlag erhalten, damit ich sie nur prüfen muss.
- Als Inhaber möchte ich die Aufschlüsselung sehen (Umsätze 19 %/7 %/0 %, Vorsteuer, Zahllast) mit den zugrunde liegenden Buchungen, damit ich die Zahlen nachvollziehe.
- Als Inhaber möchte ich, dass nur belegte Vorsteuer berücksichtigt wird, damit die Voranmeldung sauber ist.
- Als Inhaber möchte ich gewarnt werden, wenn offene Prüffälle oder fehlende Belege im Zeitraum die Zahlen verfälschen könnten, damit ich erst abschließe, wenn alles sauber ist.
- Als Inhaber möchte ich die Kennzahlen ELSTER-konform aufbereitet sehen, damit ich sie nur noch übertragen muss.

## Acceptance Criteria
- [ ] Auswahl des Voranmeldungszeitraums gemäß Profil-Rhythmus (Monat/Quartal); Jahresübersicht aller Perioden
- [ ] Berechnung je Periode: steuerpflichtige Umsätze je Satz (19 %/7 %/0 %), Umsatzsteuer, abziehbare Vorsteuer (nur aus per PROJ-6 belegten Eingangsbuchungen), Zahllast/Erstattung
- [ ] Zuordnung jeder Kennzahl zur korrekten ELSTER-USt-Voranmeldungs-Feldnummer
- [ ] Drill-down: zu jeder Kennzahl die Liste der einbezogenen Buchungen/Belege einsehbar
- [ ] Warnhinweise: offene Prüffälle (PROJ-7) im Zeitraum, Geschäftsbuchungen ohne Beleg (PROJ-6), unklassifizierte Buchungen — mit Anzahl
- [ ] Periode kann als „geprüft/abgeschlossen" markiert werden; danach Snapshot der Zahlen unveränderlich (Korrektur nur über neue Berechnung/Berichtigung)
- [ ] Nur als geschäftlich + steuerrelevant klassifizierte Buchungen fließen ein; private/neutrale Buchungen sind ausgeschlossen
- [ ] Rechnerische Korrektheit ist durch deterministische Aggregation gewährleistet (keine KI in der Endsumme)

## Edge Cases
- Was passiert bei nachträglich importierten Buchungen für eine bereits abgeschlossene Periode? (Hinweis auf Berichtigungsbedarf, kein stilles Überschreiben)
- Wie werden Buchungen ohne eindeutige Periode (Datum unklar) behandelt? (Ausschluss + Warnung)
- Wie wird mit Vorsteuer aus Buchungen ohne Beleg umgegangen? (nicht abziehbar, in Warnliste)
- Wie werden Stornos/Gutschriften innerhalb der Periode verrechnet?
- Was passiert bei Kleinunternehmer-Konstellation/Profilwechsel? (Nullmeldung / Hinweis — gesteuert durch PROJ-1-Profil)
- Wie wird mit 0 % / nicht steuerbaren Umsätzen (z.B. Reverse-Charge) umgegangen? (separate Kennzahl, kein USt-Ausweis)

## Technical Requirements
- Korrektheit: deterministische, nachprüfbare Aggregation; Drill-down auf Belegebene
- Integrität: abgeschlossene Perioden als unveränderlicher Snapshot
- Konformität: Mapping auf aktuelle ELSTER-USt-VA-Feldnummern (Pflege als Stammdaten)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (deterministisches Rechenmodul, keine KI)
Steuerlich belastbare Aggregation → rein rechnerisch, reproduzierbar.

### Komponentenstruktur
```
USt-Voranmeldung (/ust-voranmeldung)
+-- Perioden-Auswahl (Monat/Quartal gemäß Profil) + Jahresübersicht
+-- Kennzahl-Tabelle (Umsätze 19/7/0 %, USt, Vorsteuer, Zahllast) mit ELSTER-Feldnr.
+-- Drill-down-Sheet je Kennzahl (einbezogene Buchungen/Belege)
+-- Warnpanel (offene Prüffälle, fehlende Belege, unklassifiziert)
+-- "Periode als geprüft abschließen"-Aktion (Snapshot)
```

### Datenmodell (Klartext)
**Steuerperiode (USt)**: Zeitraum, Status (offen/geprüft/abgeschlossen), eingefrorener Kennzahl-Snapshot. Aggregation liest nur geschäftlich + steuerrelevante Buchungen; Vorsteuer nur aus per PROJ-6 belegten Eingängen. ELSTER-Feld-Mapping als Stammdaten.

### Tech-Entscheidungen (Begründung)
- **`lib/tax/ust` rein deterministisch:** keine KI in Endsummen → rechtssicher reproduzierbar.
- **Snapshot bei Abschluss:** abgeschlossene Periode unveränderlich; spätere Buchungen → Berichtigungshinweis.
- **Profilgesteuert (PROJ-1):** Rhythmus und USt-Status (z.B. Kleinunternehmer → Nullmeldung).
- **ELSTER-Feld-Mapping als pflegbare Stammdaten:** überlebt Formularänderungen.

### Abhängigkeiten (Pakete)
Keine neuen.

### Edge-Case-Behandlung
Nachträgliche Buchungen → Berichtigungshinweis statt stillem Überschreiben; unklares Datum → Ausschluss + Warnung; Vorsteuer ohne Beleg nicht abziehbar; Storno/Gutschrift verrechnet; Reverse-Charge/0 % separate Kennzahl.

## Implementierungsnotizen

**Stand:** In Progress (Implementierung abgeschlossen, QA ausstehend)

### Gebaute Dateien
- `src/lib/tax/perioden.ts` — reine, generische Periodenlogik (date-fns):
  USt-VA-Perioden je Jahr (monatlich=12 / quartalsweise=4 / jährlich=1),
  Start/Ende je Periode, `periodeFuerDatum`, Wirtschaftsjahr-Grenzen
  (`wirtschaftsjahrGrenzen`, `wirtschaftsjahrZuDatum`) + robustes ISO-Parsing.
  Wirtschaftsjahr-Teil bewusst generisch — von PROJ-9 lesend mitnutzbar.
- `src/lib/tax/ust.ts` — rein deterministische USt-VA-Berechnung. Rechnung in
  Cent (keine Float-Drift), Brutto→Netto-Herausrechnung je Satz, Umsätze
  19/7/0, Umsatzsteuer, abziehbare Vorsteuer **nur** aus belegten
  Eingangsbuchungen, unbelegte Vorsteuer separat (Diagnostik). ELSTER-Feld-Map
  `ELSTER_USTVA` als pflegbare Konstante (Kz 81/86/35/66/83).
  Kleinunternehmer → Nullmeldung + Hinweis. Filter: nur
  klassifikation='geschaeftlich' UND steuerrelevant=true.
- `src/lib/tax/ust.test.ts` + `src/lib/tax/perioden.test.ts` — 30 Vitest-Tests
  (Perioden monatlich/quartal/jährlich, Schaltjahr, abweichendes WJ,
  Umsatz/Vorsteuer je Satz, Vorsteuer ohne Beleg, private/neutrale
  ausgeschlossen, Zahllast-Vorzeichen, Storno-Verrechnung,
  Kleinunternehmer-Nullmeldung, Cent-Rundung).
- `src/lib/validation/ustva.ts` — Zod (Perioden-Query mit coerce,
  Abschluss-Body).
- `src/app/api/steuer/ust/route.ts` — GET berechnet on-the-fly aus aktuellen
  Daten ODER liefert Snapshot wenn abgeschlossen (+ Berichtigungshinweis bei
  Abweichung); liefert Jahresübersicht, Warnungen mit Anzahl
  (offene Prüffälle, Geschäftsbuchungen ohne Beleg, unklassifiziert, unklares
  Datum, ohne USt-Satz) sowie `buchung_details` für den Drill-down. POST
  friert Snapshot ein (status='abgeschlossen', unveränderlich, kein stilles
  Überschreiben), Audit-Eintrag. getApiUser→401, owner-scoped, Zod.
- `src/app/(app)/ust-voranmeldung/page.tsx` + `src/components/ustva/*`
  (`ustva-ansicht.tsx`, `kennzahl-drilldown.tsx`, `typen.ts`) —
  Perioden-Auswahl + Jahresübersicht, Kennzahl-Tabelle mit ELSTER-Feldnr.,
  Drill-down-Sheet je Kennzahl (einbezogene Buchungen, Beleg-Status),
  Warnpanel, Abschluss-Button mit Bestätigungsdialog. Lade-/Fehler-/
  Leerzustände, nur shadcn/ui, Deutsch.

### Designentscheidungen / Hinweise
- USt-VA-Perioden folgen dem **Kalenderjahr** (USt ist Kalenderjahr-Steuer);
  die Wirtschaftsjahr-Funktionen in `perioden.ts` sind unabhängig davon
  generisch für PROJ-9 (EÜR) ausgelegt.
- Gutschriften/Stornos werden über das Betragsvorzeichen automatisch
  saldiert (negative Einnahme/Ausgabe).
- Drill-down nutzt die bereits geladene API-Antwort (`buchung_details`),
  kein zusätzlicher Roundtrip; vollständige Belegdetails bleiben auf der
  Buchungsseite.

### Status Verifikation
- `npx tsc --noEmit`: fehlerfrei (gesamtes Projekt).
- ESLint auf allen PROJ-8-Pfaden: keine Fehler/Warnungen.
- Vitest: 30/30 Tests grün (perioden + ust).

### Offene Punkte (für /qa)
- Manuelle E2E-Prüfung der Seite mit echten Buchungsdaten steht aus.
- DB-Migration `0001_init_steueragent.sql` deckt `steuerperiode` bereits ab
  (keine Schemaänderung nötig).

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
