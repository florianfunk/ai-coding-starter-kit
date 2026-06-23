# PROJ-27: Cockpit-Dashboard (Health-Score, USt-VA-Fristen-Countdown, Aktivitäts-Feed)

## Status: Deployed
**Created:** 2026-06-23
**Last Updated:** 2026-06-23
**Priorität:** P1

> **QA 2026-06-23: APPROVED — deploybar.** Backend (Bruno) AC1–AC5 code-verifiziert,
> 38 Dashboard-Tests grün. Frontend (Quirin, QA Frontend) AC6/AC7/AC4-UI/AC8 PASS,
> keine kritischen Fehler. Null-Safety wasserdicht (fristen===null, score===null/
> ist_leer, leeres aktivitaet[] alle defensiv; Division-durch-0-Guard im Donut).
> Keine Regression (Sync-Status/Fehlertext + klickbare KPIs + Periodenblock erhalten).
> **Behoben nach QA:** Donut-Strich nutzt jetzt currentColor + farbKlasse (Dark-Mode-
> Variante) statt fester Hex-Werte.
> **Offen vor Deploy:** Migration 0017 (dauerfristverlaengerung) einspielen.
> Verifikation: `npm test` 854 grün, `tsc --noEmit` 0 Fehler, `npm run build` ok.

## Beschreibung
Phase 3 der Komfort-Roadmap. Der Nutzer arbeitet monatlich/geballt und will beim
Öffnen ALLES auf einen Blick (im Interview alle vier "erster Blick"-Wünsche
gewählt): Was muss ich tun? + Wie viel Steuer? + Bin ich fertig? + Was ist
passiert? Plus ein USt-VA-Fristen-Countdown (Fristen-Erinnerung "sehr wichtig").

Das Dashboard (`dashboard-editorial.tsx`) hat bereits: "Jetzt zu tun" (3 Aktions-
Counts), Snapshot-KPIs (Einnahmen/Ausgaben/Gewinn/USt), Periodenstatus, Sync-
Status. Dieses Feature ergänzt die drei fehlenden Cockpit-Bausteine:

1. **USt-VA-Fristen-Countdown:** Nächste fällige USt-VA-Periode mit Countdown
   ("fällig in 9 Tagen") + Ampel (>14 T neutral, ≤14 gelb, ≤3/überfällig rot).
   Abgabefrist = Perioden-Ende + 10 Tage (+1 Monat bei Dauerfristverlängerung).
   Rhythmus aus Firmenprofil (`ust_va_rhythmus`), Perioden-Logik aus `perioden.ts`.
2. **Health-Score ("Stand der Buchhaltung"):** Ein 0–100-Score aus vorhandenen
   Counts (% klassifiziert, % belegt, offene Prüffälle, Sync-Status, Fristen),
   mit Klartext ("Bücher zu 92 % bereit; 3 Punkte offen") und Aufschlüsselung.
3. **Aktivitäts-Feed ("Was ist passiert?"):** Die letzten N Aktionen aus
   `audit_eintrag` (Klassifizierungen) + `job_lauf` (Sync/Import), chronologisch,
   mit relativem Zeitstempel ("vor 2 Std").

Plus Schema: Feld `dauerfristverlaengerung boolean` im Firmenprofil (Migration
0017) — ohne das wäre die Fristberechnung falsch.

## Kontext / Herkunft
Nutzer-Interview 2026-06-23 (Memory `nutzer-arbeitsweise-prioritaeten`,
`tool-analyse-2026-06`). Inventur durch Emil: Dashboard zu ~80 % vorhanden,
Aktions-Counts/KPIs/Perioden in `DashboardAggregat` da; neu sind Fristen-Rechner,
Health-Score, Aktivitäts-Feed + ein Profilfeld.

## User Stories
- Als Inhaber möchte ich beim Öffnen sofort sehen, wie es um meine Buchhaltung
  steht (ein Score + Klartext), ohne mehrere Seiten zu prüfen.
- Als Inhaber möchte ich einen Countdown zur nächsten USt-VA-Frist sehen, damit
  ich (da ich nur monatlich reinschaue) keine Abgabefrist verpasse.
- Als Inhaber möchte ich angeben können, ob ich Dauerfristverlängerung habe,
  damit die Fristberechnung stimmt.
- Als Inhaber möchte ich auf einen Blick sehen, was der Agent zuletzt getan hat
  (Importe, Klassifizierungen, Sync), seit ich das letzte Mal da war.

## Acceptance Criteria
- [x] **AC1 — Fristen-Rechner (rein, testbar):** Neue reine Funktion in
  `src/lib/dashboard/` berechnet aus (Rhythmus, heutiges Datum, offene Perioden,
  Dauerfristverlängerung) die nächste fällige USt-VA-Frist: Periode, Abgabefrist
  (Ende + 10 Tage, +1 Monat bei Dauerfrist), Tage bis Frist, überfällig-Flag,
  Ampelstufe. Unit-getestet (inkl. Monats-/Quartalsrhythmus, überfällig, Dauerfrist).
- [x] **AC2 — Health-Score (rein, testbar):** Neue reine Funktion berechnet einen
  0–100-Score + Komponenten-Aufschlüsselung aus vorhandenen Aggregat-Zahlen
  (% klassifiziert, % belegt, Anteil offener Prüffälle, Sync-Fehler, Fristen-Status)
  + einen Klartext-Satz. Deterministisch, Unit-getestet.
- [x] **AC3 — Aktivitäts-Feed (API):** Neue Lese-Aggregation liefert die letzten
  ~20 Aktionen aus `audit_eintrag` + `job_lauf`, owner-scoped, chronologisch DESC,
  mit Art/Titel/Zeitpunkt. Reine Mapping-Logik getrennt + getestet.
- [x] **AC4 — Dauerfristverlängerung:** Migration 0017 ergänzt
  `firmenprofil.dauerfristverlaengerung boolean not null default false`; Zod-Schema
  + Firma-Einstellungen-UI bekommen einen Schalter; Wert fließt in den Fristen-Rechner.
- [x] **AC5 — Aggregat-Erweiterung:** `DashboardAggregat` (load.ts/aggregate.ts) wird
  um `fristen`, `health_score`, `aktivitaet` erweitert; bestehende Felder unverändert.
- [x] **AC6 — Cockpit-UI:** Dashboard zeigt oben einen Health-Score (Ring/Balken +
  Klartext), einen Fristen-Countdown (Ampel-Badge) und einen Aktivitäts-Feed.
  Editorial-Stil konsistent (PageShell/Section/StatBlock, Haarlinien). KPIs/Aktionen
  bleiben klickbar.
- [x] **AC7 — Leerer/Onboarding-Zustand:** Bei leerer Buchhaltung (`ist_leer`) /
  fehlenden Daten degradiert das Cockpit sauber (kein Crash, sinnvolle Empty States;
  z. B. "Noch keine Aktivität", "Keine offene Frist").
- [x] **AC8 — Keine Regression:** Bestehendes Dashboard (Jetzt-zu-tun, Snapshot,
  Periodenstatus, Sync) unverändert funktionsfähig. Alle Tests grün, build ok,
  RLS/Owner-Scope auf allen neuen Reads gewahrt.

## Out of Scope (spätere Phasen)
- Erweiterung des Audit-Loggings auf neue Entitäten (Beleg-Matching, Importe als
  eigene Audit-Einträge) → Feed nutzt vorerst audit_eintrag + job_lauf.
- Trend-Sparklines / Vorjahresvergleich der KPIs → Phase 3b.
- Command-Palette (Cmd+K) → separates Feature.
- E-Mail-Fristen-Erinnerung → später (jetzt nur im Tool).

## Implementation Notes

### Backend (Bruno, 2026-06-23) — AC1–AC5
- **AC1 Fristen-Rechner:** `src/lib/dashboard/fristen.ts` → reine `naechsteUstFrist(args)`.
  Wiederverwendet `ustVaPerioden`/`parseDatum` aus `src/lib/tax/perioden.ts` (nicht neu
  gebaut). Abgabefrist = Perioden-Ende + 10 Tage (+1 Monat via `addMonths` bei Dauerfrist).
  Kandidaten = Vorjahr + aktuelles Jahr (überfällige Vorjahresfristen sichtbar). Älteste
  offene überfällige Periode hat Vorrang; sonst nächste künftige. Ampel: >14 neutral,
  4..14 gelb, <=3/überfällig rot. `heute` als Parameter (testbar). 11 Unit-Tests
  (`fristen.test.ts`): monatlich/quartalsweise/jährlich, überfällig, mit/ohne Dauerfrist,
  abgeschlossene Periode übersprungen, null bei keiner offenen Frist.
- **AC2 Health-Score:** `src/lib/dashboard/health-score.ts` → reine `berechneHealthScore(args)`.
  Gewichtung (Summe 100): Klassifizierung 30, Belege 25, Prüffälle 20, Sync 10, Fristen 15.
  Jede Komponente liefert 0..100 % Erfüllung; gewichteter Mittelwert → Score (auf Rohsumme
  gerundet). Leer-Zustand (gesamt_buchungen=0): `score=null` + Onboarding-Hinweistext
  (ein leerer Account ist nicht "fertig"). Deutscher Klartext mit offenen Punkten.
  6 Unit-Tests (`health-score.test.ts`).
- **AC3 Aktivitäts-Feed:** `src/lib/dashboard/aktivitaet.ts` → reine `baueAktivitaet(audit, jobs)`
  (Mapping audit-aktion/job-art+status → Art+deutscher Titel, Merge, DESC, Top-20) + DB-Load
  `ladeAktivitaet(supabase, ownerId)` (letzte 30 audit + 20 job_lauf, owner-scoped zusätzlich
  zur RLS). 6 Unit-Tests (`aktivitaet.test.ts`).
- **AC4 Dauerfristverlängerung:** Migration `0017_firmenprofil_dauerfrist.sql`
  (`dauerfristverlaengerung boolean not null default false`). Zod-Schema, FormValues + Defaults
  in `src/lib/validation/firma.ts`; Typ `Firmenprofil` in `src/lib/types.ts`; API
  `src/app/api/firma/route.ts` (lesen+schreiben). `firma-form.tsx` mappt das Feld durch
  (UI-Schalter folgt im Frontend-Schritt durch Felix).
- **AC5 Aggregat:** `DashboardAggregat` (aggregate.ts) um `fristen`, `health_score`,
  `aktivitaet` erweitert (Typen importiert). `load.ts`: Firmenprofil-Load um `ust_va_rhythmus`
  + `dauerfristverlaengerung`; abgeschlossene USt-VA-Perioden aus `perioden` abgeleitet;
  `naechsteUstFrist`/`berechneHealthScore`/`ladeAktivitaet` aufgerufen; ins Return eingehängt.
  `heute`/`refDatum` via vorhandener `heuteIso()`-Mechanik.
- **Tests:** `npx vitest run src/lib/dashboard/` → 4 Dateien, 38 Tests grün; volle Suite
  854 Tests grün; `npx tsc --noEmit` 0 Fehler.
- **Offen für Frontend (Felix):** Cockpit-UI (AC6), UI-Schalter Dauerfristverlängerung,
  Empty-States (AC7).

### Frontend (Felix, 2026-06-23) — AC6, AC7, AC4-UI
- **AC6 Cockpit-UI:** Drei neue, server-renderbare Komponenten unter
  `src/components/dashboard/`:
  - `health-score-card.tsx` — SVG-Donut (kein Chart-Lib) mit Score 0..100 +
    farbcodiertem Ring (≥80 income, ≥50 highlight, sonst destructive) + Klartext +
    Komponenten-Aufschlüsselung (Balken je `komponenten[]` mit label + erfuellung%).
  - `fristen-countdown.tsx` — Ampel-Badge (`ampel` → neutral=cyan, gelb=yellow,
    rot=cerise); Countdown "fällig in N Tagen" bzw. "seit N Tagen überfällig"/"heute
    fällig"; Abgabefrist-Datum; Klick → `/ust-voranmeldung?jahr=…`.
  - `aktivitaet-feed.tsx` — Timeline-Zeilen mit Icon je `art` (Tag/RefreshCw/Upload/
    CheckCircle2/Dot) + relativem Zeitstempel.
  - Eingebunden in `dashboard-editorial.tsx`: neue Section "Cockpit" (Health-Score
    2/3 + Fristen 1/3) ganz oben; "Was ist passiert?"-Feed ersetzt die alte
    "Letzte Aktivität"; Sync-Status bleibt als eigene Section "Quellen" (kein
    Infoverlust). Bestehende Blöcke (Jetzt zu tun, Snapshot-KPIs klickbar,
    Periodenstatus) unverändert → AC8.
- **AC7 Empty-States:** Health-Score (`ist_leer`/`score===null`) → Onboarding-Hinweis;
  Fristen (`null`) → dezent "Keine offene USt-VA-Frist"; Feed (leer) → "Noch keine
  Aktivität". Kein Crash bei leerem Account.
- **AC4-UI:** shadcn `Switch` "Dauerfristverlängerung" in `firma-form.tsx`
  (react-hook-form `FormField` auf `dauerfristverlaengerung`, `checked`/`onCheckedChange`)
  mit Hilfetext "Verlängert die USt-VA-Abgabefrist um einen Monat".
- **Helper:** `formatRelativeZeit()` in `src/components/dashboard/format.ts`
  (de-DE, "vor 2 Std"/"gestern"/…, jetzt-Parameter testbar).
- **Ergebnis:** `npx tsc --noEmit` 0 Fehler; `npm run build` erfolgreich.
