# PROJ-10: Einkommensteuer-Vorschau & Privatentnahmen-Aufstellung

## Status: Planned
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-9 (Jahres-EÜR) — Gewinn als Bemessungsgrundlage

## Beschreibung
Zwei zusammengehörige Auswertungen auf Basis der Jahres-EÜR: (1) eine **grobe Einkommensteuer-Vorschau** auf den EÜR-Gewinn als Orientierung (kein Steuerbescheid) und (2) eine **Privatentnahmen-Aufstellung** aller als privat klassifizierten Zahlungen, sauber getrennt von der betrieblichen Sphäre.

## User Stories
- Als Inhaber möchte ich eine ungefähre Einkommensteuer-Schätzung auf meinen Gewinn sehen, damit ich Rücklagen planen kann.
- Als Inhaber möchte ich einfache Eckparameter angeben (Steuerjahr, ggf. weitere Einkünfte, Veranlagungsart), damit die Schätzung realistischer wird.
- Als Inhaber möchte ich eine vollständige Liste aller privaten Entnahmen/Ausgaben sehen, damit ich die private Sphäre nachvollziehen und belegen kann.
- Als Inhaber möchte ich klar kommuniziert bekommen, dass dies eine unverbindliche Schätzung ist, damit ich keine falschen Schlüsse ziehe.
- Als Inhaber möchte ich die Privatentnahmen exportieren/aufbereiten können, damit ich sie meinem Steuerberater geben kann.

## Acceptance Criteria
- [ ] ESt-Vorschau nutzt den Gewinn aus der abgeschlossenen/aktuellen Jahres-EÜR (PROJ-9) als Ausgangsbasis
- [ ] Eingabe optionaler Parameter: Steuerjahr, Veranlagungsart (Einzel/Zusammen), grobe weitere Einkünfte, Vorauszahlungen — mit sinnvollen Defaults
- [ ] Berechnung wendet den Einkommensteuertarif des gewählten Jahres an (Grundfreibetrag, Progression, ggf. Soli) und zeigt geschätzte Steuer + Effektiv-/Grenzsteuersatz
- [ ] Deutlich sichtbarer Disclaimer: unverbindliche Schätzung, kein Ersatz für Steuerberatung/Bescheid
- [ ] Privatentnahmen-Aufstellung listet alle als privat klassifizierten Buchungen (Datum, Konto, Betrag, Empfänger, ggf. Kategorie), summiert je Zeitraum
- [ ] Privatentnahmen sind nachweislich aus der betrieblichen EÜR ausgeschlossen (Konsistenz zu PROJ-9)
- [ ] Beide Auswertungen sind je Jahr reproduzierbar und mit Drill-down auf Buchungsebene

## Edge Cases
- Was passiert bei negativem Gewinn (Verlust)? (Steuer 0, Hinweis auf Verlustberücksichtigung — ohne verbindliche Aussage)
- Wie wird mit unvollständiger/nicht abgeschlossener EÜR umgegangen? (Vorschau auf vorläufiger Basis + deutlicher Hinweis)
- Wie wird ein veralteter Steuertarif behandelt, wenn das Jahr noch nicht hinterlegt ist? (letzter bekannter Tarif + Warnung)
- Was passiert, wenn keine privaten Buchungen klassifiziert wurden? (leere, aber valide Aufstellung)
- Wie werden gemischte/aufgeteilte Buchungen (PROJ-7-Split) in der Privatentnahme berücksichtigt? (nur Privatanteil)
- Wie wird verhindert, dass die Schätzung als verbindlich missverstanden wird? (durchgängiger Disclaimer)

## Technical Requirements
- Korrektheit: jahresabhängiger ESt-Tarif als gepflegte Stammdaten; deterministische Berechnung
- Klarheit: prominenter Unverbindlichkeits-Disclaimer
- Konsistenz: Privatentnahmen exakt komplementär zur betrieblichen EÜR (PROJ-9)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (deterministisches Rechenmodul + Tarif-Stammdaten)
ESt-Tarifrechnung jahresabhängig, reproduzierbar.

### Komponentenstruktur
```
Einkommensteuer (/einkommensteuer)
+-- Tab "ESt-Vorschau": Parameter-Formular (Jahr, Veranlagung, weitere Einkünfte,
|     Vorauszahlungen) + geschätzte Steuer + Effektiv-/Grenzsteuersatz
|   +-- Prominenter Unverbindlichkeits-Disclaimer (shadcn alert)
+-- Tab "Privatentnahmen": Liste aller privaten Buchungen, summiert je Zeitraum
    +-- Drill-down auf Buchungsebene
```

### Datenmodell (Klartext)
Keine neue Kerntabelle: nutzt EÜR-Gewinn (PROJ-9) + **ESt-Tarif-Stammdaten** je Jahr (Grundfreibetrag, Progressionszonen, Soli). Privatentnahmen = Buchungen mit Klassifikation „privat" (inkl. Privatanteil aus PROJ-7-Splits).

### Tech-Entscheidungen (Begründung)
- **`lib/tax/est` deterministisch, Tarif als gepflegte Stammdaten:** kein hartkodierter Tarif, jahresweise pflegbar.
- **Klar als Schätzung deklariert (Disclaimer):** keine verbindliche Aussage, Haftungsschutz.
- **Privatentnahmen komplementär zur EÜR:** Konsistenzgarantie zu PROJ-9.

### Abhängigkeiten (Pakete)
Keine neuen (`date-fns` aus PROJ-9 wiederverwendet).

### Edge-Case-Behandlung
Verlust → Steuer 0 + neutraler Hinweis; unvollständige EÜR → vorläufig + Hinweis; fehlender Tarif → letzter bekannter + Warnung; keine Privatbuchungen → valide Leerliste; Splits nur mit Privatanteil; durchgängiger Disclaimer.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
