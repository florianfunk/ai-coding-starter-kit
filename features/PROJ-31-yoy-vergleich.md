# PROJ-31: Vorjahresvergleich (YoY) der Dashboard-KPIs

## Status: Deployed
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
- [x] **AC1 — YoY-Aggregation (rein, testbar):** Neue reine Funktion berechnet
  für ein Bezugs-WJ die Kennzahlen des Vorjahres-WJ (Einnahmen, Ausgaben,
  USt-Zahllast, Gewinn). Wenn das Bezugsjahr das LAUFENDE WJ ist, wird das
  Vorjahr auf denselben Year-to-Date-Ausschnitt begrenzt (Vorjahr nur bis zum
  analogen Monats-/Tagespunkt). Ist das Bezugsjahr abgeschlossen (nicht das
  laufende), wird das volle Vorjahr verglichen. Gleiche Klassifikations-/USt-
  Logik wie `berechneJahresKennzahlen`. Unit-getestet (YTD-Kürzung, volles
  Vorjahr, leeres Vorjahr=0, abweichendes WJ).
- [x] **AC2 — Delta-Bildung:** Pro KPI absolutes Δ (aktuell − vorjahr) und
  prozentuales Δ; Division-durch-0 (Vorjahr=0) sauber behandelt (kein NaN/∞ —
  z. B. „—" oder „neu"). Reiner Helfer, frontend-unabhängig testbar.
- [x] **AC3 — Aggregat-Erweiterung:** `DashboardAggregat` bekommt `vorjahr`
  (Werte + Deltas); bestehende Felder unverändert. Über `load.ts` ohne
  zusätzlichen DB-Roundtrip, wenn möglich (Vorjahres-Buchungen müssen ggf.
  zusätzlich geladen werden — dann EIN zusätzlicher zeitgefilterter Query mit
  Limit, dokumentiert).
- [x] **AC4 — YoY-UI:** Unter den vier Snapshot-StatBlocks je eine dezente
  YoY-Zeile mit Vorjahreswert + Δ (Pfeil ▲/▼ + Farbe nach Tone, NICHT
  gut/schlecht-wertend, konsistent mit PROJ-30-DeltaIndikator). „YTD"-Kennzeichen
  wenn das laufende Jahr aktiv ist. dark-mode-fest (currentColor/Tone-Klassen).
- [x] **AC5 — Empty/Degradation:** Kein Vorjahr vorhanden / leerer Account →
  kein Crash, YoY-Zeile blendet sich sauber aus oder zeigt „kein Vorjahr".
  Bestehendes Dashboard (auch ist_leer) unverändert.
- [x] **AC6 — A11y:** Δ-Werte tabular-nums; aria-labels für die YoY-Veränderung.
- [x] **AC7 — Keine Regression:** StatBlocks bleiben klickbar; Sparklines
  (PROJ-30), Cockpit/Health/Fristen/Aktivität unverändert. tsc 0, build ok, alle
  Tests grün. Kein Schema/Migration (rein aus vorhandenen Buchungen).

## Implementation Notes

Implementiert von Bruno (Backend) im isolierten Worktree.

### Neue Dateien
- **`src/lib/dashboard/yoy.ts`** — reine Aggregations-/Delta-Helfer:
  - `berechneYoy(buchungen, aktuell, refDatum, heute, wjBeginnMonat)`: leitet
    das Bezugs-WJ aus `refDatum` ab (via `laufendesWirtschaftsjahr`), prüft
    gegen das laufende WJ aus `heute`. Ist das Bezugs-WJ das laufende →
    `ist_ytd=true` und der Vorjahres-Zeitraum endet am **analogen Tag**
    (`heute − 1 Jahr`, geklammert auf das volle Vorjahr-WJ-Ende). Sonst volles
    Vorjahr-WJ. Summiert die Vorjahres-KPIs mit **identischer** Klassifikations-/
    Vorzeichen-/USt-Logik wie `berechneJahresKennzahlen` (nur
    `klassifikation==='geschaeftlich'`, USt-Satz nur 0/7/19, Einnahmen-USt =
    `betrag*satz/(100+satz)`, Vorsteuer analog auf alle geschäftl. Ausgaben mit
    Satz; `rundeCent`). Gewinn = Einnahmen − Ausgaben (netto, cent-gerundet) —
    1:1 wie `vorlaeufiger_gewinn`.
  - `bildeDelta(aktuell, vorjahr)`: absolutes Δ (cent-gerundet) + prozentuales Δ
    (1 Nachkommastelle). **/0-Schutz:** Vorjahr=0 → `prozent=null`,
    `ist_neu=(aktuell≠0)` — kein NaN/∞. Prozent auf `|vorjahr|` bezogen, damit
    das Vorzeichen von `absolut` die Richtung bestimmt (auch bei negativem
    Vorjahr, z. B. Verlust → Gewinn).
  - `minusEinJahr(iso)`: UTC-stabile −1-Jahr-Verschiebung mit 29.02.→28.02.-
    Klemmung (verhindert Monats-Rollover im Nicht-Schaltjahr).
- **`src/lib/dashboard/yoy.test.ts`** — 15 Tests: Delta-Bildung inkl. /0 &
  negatives Vorjahr & Rundung; volles Vorjahr (abgeschlossenes Bezugsjahr);
  YTD-Schnitt (Kalenderjahr + abweichendes WJ April); Schalttag-Klemmung;
  leeres Vorjahr & komplett leere Eingabe (kein Crash); USt-/Gewinn-Konsistenz
  zu `berechneJahresKennzahlen`; Ignorieren nicht-geschäftlicher Buchungen.
- **`src/components/dashboard/kpi-yoy.tsx`** — `KpiYoy`: dezente YoY-Zeile
  (Haarlinie `border-line-hair`, `text-[11px]`, `tabular-nums`). Pfeil ▲/▼/–
  folgt dem Δ-Vorzeichen, Farbe folgt `tone` (income/expense) wie PROJ-30
  (NICHT gut/schlecht-wertend), neutral bei Δ=0. Zeigt „Vorjahr X €", bei
  YTD ein dezentes „YTD"-Badge, und Δ als Prozent bzw. „neu"/„—". aria-label
  beschreibt Richtung + Betrag + Prozent + YTD-Hinweis. dark-mode-fest über
  Tone-Textklassen, KEINE festen Hex.

### Geänderte Dateien
- **`src/lib/dashboard/aggregate.ts`** — `DashboardAggregat` um
  `vorjahr: YoyVergleich | null` erweitert (Type-Import aus `./yoy`). Alle
  bestehenden Felder + `berechneJahresKennzahlen` **unverändert**.
- **`src/lib/dashboard/load.ts`** — EIN zusätzlicher zeitgefilterter Query auf
  das Vorjahres-WJ-Fenster (`vjVon`/`vjBis` = `von`/`bis` − 1 Jahr), gefiltert
  auf `klassifikation='geschaeftlich'`, vollständig paginiert via `ladeAlle`
  (Obergrenze, **kein** unbeschränkter Scan). Ergebnis → `berechneYoy` mit den
  bereits berechneten `jahr`-KPIs als „aktuell" (garantiert konsistent zum
  Snapshot). `vorjahr` ist `null`, wenn der Account keine Buchungen hat
  (`gesamtBuchungenC === 0`).
- **`src/components/dashboard/dashboard-editorial.tsx`** — `vorjahr`
  destrukturiert; `zeigeYoy = vorjahr != null && !vorjahr.vorjahr_leer`; je eine
  `KpiYoy`-Zeile unter Betriebseinnahmen/-ausgaben/Gewinn/USt-StatBlock. Bei
  fehlendem/leerem Vorjahr blenden die Zeilen sauber aus.

### Entscheidungen / Annahmen
- **„Laufendes WJ"-Erkennung** über Vergleich des WJ-Beginn-Jahrgangs
  (`laufendesWirtschaftsjahr(refDatum)` vs. `(heute)`). Bei aktivem Vorjahr
  (PROJ-22) ist `refDatum` der 1. Tag des WJ in dem gewählten Jahr → Bezug ist
  dann abgeschlossen → volles Vorjahr.
- **YTD-Cutoff kalender-analog** (`heute − 1 Jahr`) statt „gleiche Anzahl Tage
  seit WJ-Beginn" — robuster gegen Schaltjahre und intuitiv („Vorjahr bis zum
  selben Datum"). Bei `heute` jenseits des WJ-Endes wird auf das volle WJ-Ende
  geklammert.
- **`aktuell`-KPIs werden aus `jahr` durchgereicht** (nicht in `berechneYoy`
  neu berechnet), damit die YoY-Deltas exakt zum angezeigten Snapshot passen.
- Kein Schema/Migration — rein aus vorhandenen `buchung`-Zeilen.

### Verifikation
- `npx tsc --noEmit`: 0 Fehler.
- `npx vitest run src/lib/dashboard/`: 6 Dateien, 67 Tests grün (inkl. 15 neue).
- `npm test` (volle Suite): 900 grün, 1 skipped (vorbestehend).
- `npm run lint`: 0 Errors (6 vorbestehende Warnings in fremden Dateien).
- `npm run build`: erfolgreich.
