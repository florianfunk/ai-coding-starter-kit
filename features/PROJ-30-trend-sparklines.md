# PROJ-30: Trend-Sparklines im Dashboard (Verlauf der Kern-KPIs)

## Status: Deployed
**Created:** 2026-06-24
**Last Updated:** 2026-06-24
**Priorität:** P2

> **QA 2026-06-24: DEPLOYBAR — JA.** Backend (Bruno) AC1–AC3, 17 Trend-Tests +
> Konsistenz (Summe Monate == Jahr). Frontend (Quirin, QA Frontend) AC4–AC7 PASS:
> kein Crash in allen Null-/Empty-Pfaden, usePrefersReducedMotion SSR-sicher,
> kein Layout-Bruch @375px, StatBlocks weiter klickbar, dark-mode-feste Farben
> (currentColor, kein Hex). **Behoben nach QA:** Δ-Indikator nur bei vorhandenem
> Verlauf (≥2 Datenpunkte) — beseitigt den Grenzfall „Δ ohne Linie" bei genau
> 1 Monat Daten. Kein Schema/Migration. 886 Tests grün, tsc 0, lint 0, build ok.
## Beschreibung
Mira-Empfehlung (Phase 3b). Die Snapshot-KPIs im Dashboard zeigen heute nur den
aktuellen Jahresstand. Dieses Feature ergänzt **Mini-Liniencharts (Sparklines)**
für den Verlauf der Kern-KPIs über die Monate des laufenden Wirtschaftsjahres
plus einen **Δ-Indikator zum Vormonat** — verwandelt statische Zahlen in
„Verlauf und Richtung" und macht den Überblick auf einen Blick reicher.

Die shadcn `chart`-Komponente + recharts (^2.15.4) sind installiert. Die
Datenbasis (geschäftliche Buchungen im WJ) wird in `berechneJahresKennzahlen`
bereits durchlaufen — die Monatsreihe wird daneben aus derselben Datenmenge
aggregiert (kein zusätzlicher DB-Query).

## Scope (festgelegt)
- **Drei Sparklines** über die 12 Monate des laufenden WJ: Einnahmen, Ausgaben,
  USt-Zahllast (gleiche Vorzeichen-/USt-Konvention wie die Jahres-Kennzahlen).
- **Δ-Indikator** je KPI: aktueller Monat vs. Vormonat (absolut + Pfeil/Farbe).
- Kompakte, nicht-interaktive Darstellung (Überblick, kein Analyse-Chart):
  keine Achsen/Gridlines, minimalistisch, `prefers-reduced-motion` respektieren.

## Out of Scope
- Vorjahresvergleich (Year-over-Year) → spätere Iteration.
- Interaktive Tooltips/Zoom/Drilldown aus der Sparkline.
- Sparklines für andere Seiten (nur Dashboard-Snapshot).

## User Stories
- Als Inhaber möchte ich neben jeder Kern-Kennzahl den Verlauf über das Jahr
  sehen, um Trends (steigende Ausgaben etc.) sofort zu erkennen.
- Als Inhaber möchte ich auf einen Blick sehen, ob eine Kennzahl ggü. dem Vormonat
  gestiegen oder gefallen ist.

## Acceptance Criteria
- [x] **AC1 — Monatsreihen-Aggregation (rein, testbar):** Neue reine Funktion
  berechnet aus den WJ-Buchungen pro Monat (in WJ-Reihenfolge) Einnahmen,
  Ausgaben und USt-Zahllast — gleiche Klassifikations-/USt-Logik wie
  `berechneJahresKennzahlen`. Liefert für JEDEN WJ-Monat einen Punkt (auch 0).
  Unit-getestet (Verteilung über Monate, leere Monate=0, WJ-Beginn ≠ Januar,
  Vorzeichen/USt-Konvention).
- [x] **AC2 — Δ zum Vormonat:** Pro KPI wird der Wert des aktuellen Monats und der
  Vormonat ausgewiesen (bzw. der jüngste Monat mit Daten), als Δ berechenbar.
  Backend liefert reinen Helfer `letzterUndVormonat`; Δ-Bildung (aktuell − vormonat)
  und Pfeil/Farbe bleiben dem Frontend (Felix, AC4) überlassen.
- [x] **AC3 — Aggregat-Erweiterung:** `DashboardAggregat` bekommt neues Feld
  `trend: MonatsPunkt[]`; bestehende Jahres-Kennzahlen (`jahr`) unverändert.
- [x] **AC4 — Sparkline-UI:** Neben/unter den drei Snapshot-KPIs (Einnahmen,
  Ausgaben, USt) je eine Sparkline (recharts LineChart, minimal, keine Achsen) +
  Δ-Indikator (Pfeil ▲/▼ + Farbe income/expense). Editorial-Stil, Haarlinien.
- [x] **AC5 — Empty/Degradation:** Bei leerem WJ / nur einem Monat Daten / leerem
  Account kein Crash; Sparkline blendet sich sauber aus oder zeigt eine flache
  Linie/Empty-Hinweis. Bestehendes Dashboard (auch ist_leer) unverändert.
- [x] **AC6 — A11y & Motion:** Sparkline-SVG mit aria-label (z. B. „Verlauf
  Einnahmen, aktueller Monat X"); `prefers-reduced-motion` → keine Animation;
  tabular-nums für Δ-Werte.
- [x] **AC7 — Keine Regression:** Snapshot-KPIs bleiben klickbar (href), restliches
  Dashboard (Cockpit/Health/Fristen/Aktivität/Perioden) unverändert. tsc 0, build
  ok, alle Tests grün. Kein Schema/Migration (rein aus vorhandenen Buchungen).

## Implementation Notes

### Backend (Bruno, 2026-06-24) — AC1–AC3
- **Neu: `src/lib/dashboard/trend.ts`** (rein, ohne DB/UI):
  - `berechneMonatsReihen(buchungen, heute, wjBeginnMonat): MonatsPunkt[]` — leitet
    das WJ-Fenster über `laufendesWirtschaftsjahr` ab, erzeugt 12 Buckets ab
    WJ-Startmonat (inkl. Jahreswechsel bei abweichendem WJ, z. B. wjBeginn=4 →
    Apr..Mrz Folgejahr) und bucketet jede geschäftliche WJ-Buchung nach `yyyy-MM`.
    Verwendet EXAKT die Klassifikations-/Vorzeichen-/USt-Logik von
    `berechneJahresKennzahlen` (klassifikation==='geschaeftlich', Intervallprüfung
    inkl. Grenzen, USt nur bei Satz 0/7/19, Einnahmen-USt = betrag*satz/(100+satz),
    Vorsteuer analog auf alle gesch. Ausgaben mit Satz). `ust_zahllast` pro Monat =
    ustEinnahmen_monat − vorsteuer_monat. Alle Werte über `rundeCent`. Leere Monate
    bleiben 0/0/0 (alle 12 Punkte vorhanden).
  - `MonatsPunkt { monat: yyyy-MM; label; einnahmen; ausgaben; ust_zahllast }`.
    Label = Monatskürzel; bei jahresübergreifendem WJ zusätzlich 2-stelliges Jahr
    (z. B. "Apr 26"), damit Monate eindeutig bleiben.
  - **Δ-Helfer im Backend** (AC2): `letzterUndVormonat(punkte): TrendDelta` liefert
    `{aktuellerIndex, einnahmen, ausgaben, ust_zahllast}` mit je `{aktuell, vormonat}`
    (jüngster Monat mit Daten + direkter Vorgänger-Bucket). Die Δ-Berechnung
    (aktuell − vormonat) sowie Pfeil/Farbe macht das Frontend (AC4).
- **`src/lib/dashboard/aggregate.ts`**: `DashboardAggregat` um `trend: MonatsPunkt[]`
  erweitert (Typ-Import aus ./trend). `berechneJahresKennzahlen` UNVERÄNDERT.
- **`src/lib/dashboard/load.ts`**: `berechneMonatsReihen(dashboardBuchungen,
  refDatum, wjBeginn)` mit denselben Inputs wie `berechneJahresKennzahlen`
  aufgerufen (kein zusätzlicher DB-Query) und als `trend` ins Return-Objekt gehängt.
- **Tests neu: `src/lib/dashboard/trend.test.ts`** — Struktur (12 Punkte/Labels),
  Verteilung, Leermonate=0, nur-Einnahmen/nur-Ausgaben, Filter (privat/ausserhalb
  WJ), USt-Konvention, abweichendes WJ (Apr + Juli, Jahreswechsel), Konsistenz
  (Summe Monatswerte == Jahreswert für Kalender- und abweichendes WJ),
  `letzterUndVormonat`.
- **Kein Schema-Eingriff.** Checks: `npx vitest run src/lib/dashboard/` 52 grün,
  volle Suite 886 grün (53 Files), `npx tsc --noEmit` 0 Fehler.
- **Offen für Felix (AC4–AC6):** Sparkline-UI (recharts LineChart, minimal),
  Δ-Indikator aus `trend` (oder optional `letzterUndVormonat`), Empty/Degradation,
  A11y/Motion.

### Frontend (Felix, 2026-06-24) — AC4–AC7
- **Neu: `src/components/dashboard/kpi-sparkline.tsx`** (`"use client"`, recharts):
  - `<KpiSparkline punkte feld tone />`. Render: `ResponsiveContainer` (Höhe 36)
    + `LineChart` mit einer `Line` (type="monotone", dot=false, strokeWidth 1.75),
    KEINE Achsen/Grid/Tooltip/Legend. Farbe dark-mode-fest via
    `stroke="currentColor"` + Wrapper-Textklasse (income → `text-income-strong
    dark:text-income`, expense → `text-destructive`) — wie Health-Score-Donut,
    keine festen Hex.
  - **AC6:** eigener `usePrefersReducedMotion`-Hook → `isAnimationActive` aus;
    LineChart trägt `role="img"` + `aria-label="Verlauf {Feld}, {N} Monate"`;
    Δ-Werte `tabular-nums`.
  - **AC5:** bei < 2 nicht-null Punkten (leer / nur ein Monat) keine Linie,
    stattdessen dezenter Hinweis „Noch kein Verlauf". `punkte ?? []` → kein Crash
    bei undefined/leerem `trend`.
  - **Δ-Indikator** (`DeltaIndikator`): nutzt Backend-Helfer `letzterUndVormonat`,
    Δ = aktuell − vormonat. Pfeil ▲/▼/– nach Vorzeichen.
  - **Δ-Farbregel (bewusst schlicht):** Pfeilrichtung folgt dem Vorzeichen von Δ;
    die Farbe folgt dem `tone` der KPI (income=cyan, expense=cerise), NUR wenn
    sich etwas bewegt. Keine „gut/schlecht"-Wertung (steigende Ausgaben sind nicht
    rot-warnend). Δ = 0 / keine Daten → neutral (`text-muted-foreground`).
- **`src/components/dashboard/dashboard-editorial.tsx`**: `trend` aus `data`
  destrukturiert; je eine `<KpiSparkline>` unter den StatBlocks Betriebseinnahmen
  (income), Betriebsausgaben (expense) und USt-Zahllast (expense), getrennt durch
  Haarlinie (`border-t border-line-hair`). Gewinn-KPI ohne Sparkline (Spec).
  StatBlocks unverändert klickbar (AC7).
- **Checks:** `npx tsc --noEmit` 0 Fehler, `npm run build` erfolgreich.
