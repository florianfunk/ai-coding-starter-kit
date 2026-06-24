# PROJ-31: Vorjahresvergleich (YoY) der Dashboard-KPIs

## Status: In Progress
**Created:** 2026-06-24
**Last Updated:** 2026-06-24
**Priorität:** P2

## Beschreibung
Erweitert die Snapshot-KPIs und Trend-Sparklines (PROJ-30) um einen
**Vorjahresvergleich (Year-over-Year)**: Neben dem aktuellen Jahresstand der
Kern-KPIs (Betriebseinnahmen, Betriebsausgaben, USt-Zahllast, Gewinn) wird der
Wert desselben Zeitraums im Vorjahr gezeigt — plus die prozentuale/absolute
Veränderung. So sieht der Inhaber „läuft das Jahr besser oder schlechter als
das letzte" auf einen Blick.

Die Datenbasis entsteht aus denselben geschäftlichen Buchungen wie
`berechneJahresKennzahlen`, nur für das Vorjahres-Wirtschaftsjahr. **Wichtig
für Fairness des Vergleichs:** der Vorjahreswert wird auf denselben
*Zeitausschnitt* (Year-to-Date-Position) begrenzt — also Vorjahr nur bis zum
analogen Tag, sonst vergleicht man ein volles Vorjahr gegen ein angefangenes
laufendes Jahr (Äpfel/Birnen). Dieses Verhalten muss klar dokumentiert und in
der UI als „YTD" gekennzeichnet sein.

## Scope (festgelegt)
- **Backend (rein, testbar):** Funktion, die für ein Bezugsjahr die
  Vorjahres-Kennzahlen desselben Zeitfensters (YTD-begrenzt, wenn das
  Bezugsjahr das laufende ist) berechnet — exakt dieselbe Klassifikations-/
  Vorzeichen-/USt-Logik wie `berechneJahresKennzahlen`.
- **Aggregat-Erweiterung:** `DashboardAggregat` bekommt ein `vorjahr`-Feld
  (Einnahmen/Ausgaben/USt/Gewinn des Vorjahres-Zeitraums) plus die berechneten
  Deltas. `jahr` (aktuell) bleibt UNVERÄNDERT.
- **Frontend:** unter/neben den vier Snapshot-StatBlocks je eine dezente
  YoY-Zeile: „Vorjahr: X € · Δ +Y % ▲" (Editorial-Stil, Haarlinie, dark-mode-fest
  über currentColor/Tone-Klassen wie PROJ-30, KEINE festen Hex).

## Out of Scope
- Mehrjahres-Trend (>2 Jahre).
- YoY auf anderen Seiten (nur Dashboard-Snapshot).
- Interaktive Drilldowns aus dem YoY-Wert.

## User Stories
- Als Inhaber möchte ich sehen, wie meine Einnahmen/Ausgaben/Gewinn ggü. dem
  Vorjahr (gleicher Zeitraum) stehen, um zu erkennen, ob das Jahr besser läuft.

## Acceptance Criteria
- [ ] **AC1 — YoY-Aggregation (rein, testbar):** Neue reine Funktion berechnet
  für ein Bezugs-WJ die Kennzahlen des Vorjahres-WJ (Einnahmen, Ausgaben,
  USt-Zahllast, Gewinn). Wenn das Bezugsjahr das LAUFENDE WJ ist, wird das
  Vorjahr auf denselben Year-to-Date-Ausschnitt begrenzt (Vorjahr nur bis zum
  analogen Monats-/Tagespunkt). Ist das Bezugsjahr abgeschlossen (nicht das
  laufende), wird das volle Vorjahr verglichen. Gleiche Klassifikations-/USt-
  Logik wie `berechneJahresKennzahlen`. Unit-getestet (YTD-Kürzung, volles
  Vorjahr, leeres Vorjahr=0, abweichendes WJ).
- [ ] **AC2 — Delta-Bildung:** Pro KPI absolutes Δ (aktuell − vorjahr) und
  prozentuales Δ; Division-durch-0 (Vorjahr=0) sauber behandelt (kein NaN/∞ —
  z. B. „—" oder „neu"). Reiner Helfer, frontend-unabhängig testbar.
- [ ] **AC3 — Aggregat-Erweiterung:** `DashboardAggregat` bekommt `vorjahr`
  (Werte + Deltas); bestehende Felder unverändert. Über `load.ts` ohne
  zusätzlichen DB-Roundtrip, wenn möglich (Vorjahres-Buchungen müssen ggf.
  zusätzlich geladen werden — dann EIN zusätzlicher zeitgefilterter Query mit
  Limit, dokumentiert).
- [ ] **AC4 — YoY-UI:** Unter den vier Snapshot-StatBlocks je eine dezente
  YoY-Zeile mit Vorjahreswert + Δ (Pfeil ▲/▼ + Farbe nach Tone, NICHT
  gut/schlecht-wertend, konsistent mit PROJ-30-DeltaIndikator). „YTD"-Kennzeichen
  wenn das laufende Jahr aktiv ist. dark-mode-fest (currentColor/Tone-Klassen).
- [ ] **AC5 — Empty/Degradation:** Kein Vorjahr vorhanden / leerer Account →
  kein Crash, YoY-Zeile blendet sich sauber aus oder zeigt „kein Vorjahr".
  Bestehendes Dashboard (auch ist_leer) unverändert.
- [ ] **AC6 — A11y:** Δ-Werte tabular-nums; aria-labels für die YoY-Veränderung.
- [ ] **AC7 — Keine Regression:** StatBlocks bleiben klickbar; Sparklines
  (PROJ-30), Cockpit/Health/Fristen/Aktivität unverändert. tsc 0, build ok, alle
  Tests grün. Kein Schema/Migration (rein aus vorhandenen Buchungen).

## Implementation Notes
_(von den Agenten zu füllen)_
