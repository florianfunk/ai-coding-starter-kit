# PROJ-9: Jahres-EÜR (§4 Abs.3 EStG)

## Status: Planned
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-5 (Autonome Klassifizierung) — kategorisierte Buchungen
- Requires: PROJ-6 (Beleg↔Buchung-Matching) — Vollständigkeit/Belegnachweis

## Beschreibung
Verdichtet alle als geschäftlich klassifizierten und (soweit möglich) belegten Buchungen eines Wirtschaftsjahres zur Einnahmen-Überschuss-Rechnung nach §4 Abs.3 EStG: Betriebseinnahmen minus Betriebsausgaben je EÜR-Kategorie = Gewinn/Verlust, aufbereitet entlang der amtlichen EÜR-Struktur (Anlage EÜR).

## User Stories
- Als Inhaber möchte ich für ein Wirtschaftsjahr eine vollständige EÜR als Vorschlag erhalten, damit ich meinen Gewinn kenne.
- Als Inhaber möchte ich Einnahmen und Ausgaben je EÜR-Kategorie aufgeschlüsselt sehen, damit ich die Zusammensetzung nachvollziehe.
- Als Inhaber möchte ich von jeder Summe zu den einzelnen Buchungen/Belegen durchklicken, damit ich Positionen prüfen kann.
- Als Inhaber möchte ich gewarnt werden, wenn offene Prüffälle, unklassifizierte Buchungen oder fehlende Belege das Ergebnis verfälschen, damit ich vor Abschluss aufräume.
- Als Inhaber möchte ich das Jahr als „abgeschlossen" markieren, damit die Zahlen als Snapshot fixiert sind.

## Acceptance Criteria
- [ ] Auswahl des Wirtschaftsjahres gemäß PROJ-1-Profil; Periodenabgrenzung korrekt (Zahlungszufluss-/-abflussprinzip der EÜR)
- [ ] Aggregation: Betriebseinnahmen und Betriebsausgaben je EÜR-Kategorie, Gesamtsumme, Gewinn/Verlust
- [ ] Ergebnis folgt der Struktur der amtlichen Anlage EÜR (Zeilenzuordnung aus PROJ-2-Kontenrahmen)
- [ ] Drill-down von jeder Kategoriesumme auf die zugrunde liegenden Buchungen und verknüpften Belege
- [ ] Private/neutrale Buchungen sind ausgeschlossen; Privatentnahmen separat ausgewiesen (Detail in PROJ-10)
- [ ] Warnhinweise: offene Prüffälle (PROJ-7), unklassifizierte Buchungen, Geschäftsbuchungen ohne Beleg (PROJ-6) mit Anzahl und Summenwirkung
- [ ] Jahr als „abgeschlossen" markierbar → unveränderlicher Snapshot; spätere Änderungen erfordern explizite Neuberechnung
- [ ] Deterministische Aggregation (keine KI in der Endsumme), nachprüfbar

## Edge Cases
- Wie wird die zeitliche Abgrenzung am Jahreswechsel behandelt (Zahlung Dez. vs. Jan.)? (striktes Zufluss-/Abflussprinzip)
- Wie werden Anschaffungen behandelt, die abzuschreiben wären (AfA)? (Kennzeichnung „AfA-relevant" / Hinweis — vereinfachte Behandlung im MVP, Detail in /architecture)
- Was passiert mit durchlaufenden Posten / Geldtransit zwischen eigenen Konten? (neutral, kein Ertrag/Aufwand)
- Wie wird mit nachträglichen Buchungen nach Jahresabschluss umgegangen? (Berichtigungshinweis, kein stilles Überschreiben)
- Was passiert, wenn ein Wirtschaftsjahr unvollständig ist (fehlende Monate/Imports)? (Vollständigkeitswarnung)
- Wie werden Umsatzsteuer-Zahllasten/-Erstattungen als Betriebsausgabe/-einnahme berücksichtigt?

## Technical Requirements
- Korrektheit: striktes Zufluss-/Abflussprinzip, deterministische Aggregation
- Nachvollziehbarkeit: lückenloser Drill-down Summe → Buchung → Beleg
- Integrität: abgeschlossenes Jahr als unveränderlicher Snapshot

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (deterministisches Rechenmodul)
EÜR-Aggregation über ein Wirtschaftsjahr, rein rechnerisch.

### Komponentenstruktur
```
EÜR (/euer)
+-- Wirtschaftsjahr-Auswahl
+-- EÜR-Aufstellung (Einnahmen/Ausgaben je Kategorie, Gewinn/Verlust) in Anlage-EÜR-Struktur
+-- Drill-down-Sheet (Kategorie → Buchungen → Belege)
+-- Warnpanel (offene Prüffälle, unklassifiziert, fehlende Belege)
+-- "Jahr abschließen"-Aktion (Snapshot)
```

### Datenmodell (Klartext)
**Steuerperiode (Wirtschaftsjahr)**: Jahr, Status, eingefrorener EÜR-Snapshot. Aggregation: geschäftliche Buchungen nach Zufluss-/Abflussprinzip, gruppiert nach Kontenrahmen-Kategorie/EÜR-Zeile. Private/neutrale ausgeschlossen.

### Tech-Entscheidungen (Begründung)
- **`lib/tax/euer` deterministisch, striktes Zufluss-/Abflussprinzip:** korrekte Periodenabgrenzung.
- **EÜR-Zeilen aus PROJ-2-Kontenrahmen:** Struktur folgt amtlicher Anlage EÜR.
- **Snapshot bei Jahresabschluss:** unveränderlich; Nachbuchungen → Berichtigungshinweis.
- **Lückenloser Drill-down:** Summe → Buchung → Beleg, voll auditierbar.

### Abhängigkeiten (Pakete)
- `date-fns` — Wirtschaftsjahr-/Periodenlogik (shared mit PROJ-8/10).

### Edge-Case-Behandlung
Jahreswechsel strikt nach Zufluss/Abfluss; AfA-relevante Anschaffungen markiert (vereinfacht im MVP); Geldtransit neutral; Nachbuchungen → Berichtigung; Vollständigkeitswarnung bei fehlenden Monaten; USt-Zahllast/-Erstattung als Ausgabe/Einnahme berücksichtigt.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
