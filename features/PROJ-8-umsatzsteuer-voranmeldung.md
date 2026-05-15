# PROJ-8: Umsatzsteuer-Voranmeldung (Vorschlag)

## Status: Planned
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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
