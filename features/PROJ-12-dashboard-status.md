# PROJ-12: Dashboard & Buchungsstatus-Übersicht

## Status: In Progress
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-6 (Beleg↔Buchung-Matching) — fehlende Belege / Matching-Status
- Requires: PROJ-7 (Prüfliste & Lernregeln) — offene Prüffälle

## Beschreibung
Zentrale Übersichtsseite (Einstieg nach Login): zeigt auf einen Blick den Buchhaltungsstand — offene Prüffälle, fehlende Belege, Klassifizierungsfortschritt, Periodenstatus für USt-VA/EÜR sowie zentrale Kennzahlen. Macht den autonomen Agenten transparent und führt den Inhaber direkt zu den Stellen, die Aufmerksamkeit brauchen.

## User Stories
- Als Inhaber möchte ich nach dem Login sofort sehen, ob etwas zu tun ist, damit ich nicht durch alle Bereiche klicken muss.
- Als Inhaber möchte ich die Anzahl offener Prüffälle und fehlender Belege sehen, damit ich Aufwand und Dringlichkeit einschätze.
- Als Inhaber möchte ich den Bearbeitungsstand je USt-VA-Periode und Wirtschaftsjahr sehen (offen/geprüft/abgeschlossen), damit ich Fristen im Blick habe.
- Als Inhaber möchte ich Kernkennzahlen sehen (Einnahmen/Ausgaben/Gewinn lfd. Jahr, voraussichtliche USt-Zahllast), damit ich meine Lage kenne.
- Als Inhaber möchte ich von jeder Kachel direkt zur zugehörigen Ansicht springen, damit ich schnell handeln kann.

## Acceptance Criteria
- [ ] Dashboard ist die Startseite nach Login und lädt aktuelle Kennzahlen
- [ ] Kacheln: offene Prüffälle (PROJ-7), fehlende Belege (PROJ-6), unklassifizierte Buchungen (PROJ-5), letzter Paperless-Sync (PROJ-3), letzter Kontoimport (PROJ-4)
- [ ] Periodenstatus-Übersicht: je USt-VA-Periode und Wirtschaftsjahr Status offen/geprüft/abgeschlossen
- [ ] Kennzahlen laufendes Jahr: Betriebseinnahmen, Betriebsausgaben, vorläufiger Gewinn, voraussichtliche USt-Zahllast (aus vorhandenen Auswertungen, klar als vorläufig markiert)
- [ ] Jede Kachel verlinkt direkt auf die zugehörige Detailansicht (Prüfliste, Fehlliste, Periode, Import)
- [ ] Dashboard zeigt nur konsistente Werte; ohne Daten klare Leerzustände/Onboarding-Hinweise
- [ ] Performance: Übersicht lädt ohne spürbare Verzögerung trotz Aggregation

## Edge Cases
- Was wird angezeigt, wenn noch keine Daten importiert wurden? (Onboarding-Leerzustand mit nächsten Schritten)
- Wie verhält sich das Dashboard, wenn eine Datenquelle (Paperless) zuletzt fehlerhaft synchronisiert hat? (Status-/Fehlerhinweis statt veralteter Stillstand)
- Wie werden vorläufige vs. abgeschlossene Kennzahlen unterschieden? (klare Kennzeichnung „vorläufig")
- Was passiert bei sehr vielen offenen Fällen? (aggregierte Zahl + Verlinkung, kein Performance-Einbruch)
- Wie aktuell sind die Kennzahlen (Caching vs. Live)? (sichtbarer Stand/Zeitstempel)

## Technical Requirements
- Performance: schnelle, gecachte Aggregation mit sichtbarem Aktualitätsstand
- Klarheit: konsistente Kennzeichnung vorläufig/abgeschlossen
- Navigation: direkte Sprungziele aus jeder Kachel

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (aggregierende Lesezugriffe)
Kennzahlen-Aggregation über mehrere Module, gecacht.

### Komponentenstruktur
```
Dashboard (/dashboard)  [Startseite nach Login]
+-- Aktions-Kacheln: offene Prüffälle, fehlende Belege, unklassifiziert,
|     letzter Paperless-Sync, letzter Kontoimport  (je verlinkt)
+-- Periodenstatus-Übersicht (USt-VA-Perioden, Wirtschaftsjahre)
+-- Kennzahlen lfd. Jahr (Einnahmen/Ausgaben/Gewinn/voraussichtl. USt-Zahllast)
+-- Leerzustand/Onboarding bei fehlenden Daten
```

### Datenmodell (Klartext)
Keine eigene Tabelle: aggregiert über Buchungen, Prüffälle (PROJ-7), Zuordnungen (PROJ-6), Sync-Jobs (PROJ-3/4), Steuerperioden (PROJ-8/9). Aktualitätsstand sichtbar.

### Tech-Entscheidungen (Begründung)
- **Server Components + gecachte Aggregation:** schnelle Übersicht trotz vieler Quellen.
- **Konsistente „vorläufig/abgeschlossen"-Kennzeichnung:** keine irreführenden Zahlen.
- **Direkte Sprungziele je Kachel:** führt den Nutzer sofort zur Aktion.

### Abhängigkeiten (Pakete)
Keine neuen.

### Edge-Case-Behandlung
Keine Daten → Onboarding-Leerzustand mit nächsten Schritten; fehlerhafter letzter Sync → Status-/Fehlerhinweis statt Stillstand; vorläufig vs. abgeschlossen klar markiert; viele offene Fälle → aggregierte Zahl + Link; sichtbarer Aktualitäts-Zeitstempel.

## Implementierungsnotizen

**Stand:** Implementiert (In Progress), bereit für /qa.

### Gebaute Dateien
- `src/lib/dashboard/aggregate.ts` — REINE, testbare Aggregationshelfer:
  `zaehleAktionen` (Prüffälle/fehlende Belege/unklassifiziert),
  `berechneJahresKennzahlen` (vorläufige Einnahmen/Ausgaben/Gewinn + grobe
  USt-Zahllast-Schätzung), `laufendesWirtschaftsjahr`, `syncStatusAus`,
  `periodenLabel`/`bereitePerioden`, `rundeCent`. Keine DB/KI/UI, keine
  Imports aus `src/lib/tax/**`.
- `src/lib/dashboard/aggregate.test.ts` — 16 Vitest-Tests (Zählungen,
  Summen, USt-Schätzung, vorläufig-Kennzeichnung, leere Daten, WJ-Grenzen,
  Periodensortierung). Alle grün.
- `src/lib/dashboard/load.ts` — serverseitiger Lade-/Aggregations-Helfer.
  Owner-scoped, count-only Queries (`count:'exact', head:true`) für die
  Aktions-Kennzahlen, zeitgefilterte Buchungen für die Jahres-Kennzahlen,
  `.limit()` auf allen Listen. Eine Datenquelle für API und Seite.
- `src/app/api/dashboard/route.ts` — GET, `getApiUser`→401, `{error}`-JSON,
  HTTP-Codes (401/500), liefert das aggregierte Objekt inkl.
  Aktualitäts-Zeitstempel.
- `src/components/dashboard/` — `format.ts` (Formatter, rein),
  `aktions-kachel.tsx`, `sync-kachel.tsx` (Fehlerhinweis bei
  `job_lauf.status='fehler'`), `kennzahlen-kachel.tsx` (klar als
  „vorläufig" markiert), `perioden-uebersicht.tsx`, `onboarding.tsx`
  (6-Schritte-Leerzustand), `dashboard-grid.tsx`. Nur shadcn/ui, Tailwind,
  responsive Kachel-Grid.
- `src/app/(app)/dashboard/page.tsx` — Server Component, Startseite,
  `requireUser()`, lädt direkt via `ladeDashboardAggregat`, rendert Grid /
  Onboarding / Fehler-Alert. Sichtbarer „Stand:"-Zeitstempel.
- `src/app/(app)/dashboard/loading.tsx` — Skeleton-Ladezustand.

### Designentscheidungen / Abweichungen
- **Vorläufige Kennzahlen bewusst konservativ:** Es fließen nur als
  `geschaeftlich` klassifizierte Buchungen des laufenden Wirtschaftsjahres
  ein; private/neutrale/unklare/unklassifizierte bleiben außen vor. Die
  tax-Module (EÜR/USt) werden NICHT importiert (Architektur §1/§2). Werte
  und USt-Zahllast sind in der UI durchgängig als „vorläufig" gekennzeichnet
  mit Verweis auf die verbindlichen Auswertungen.
- **Fehlende Belege** = geschäftliche Buchungen ohne `beleg_buchung`-Eintrag
  (Set-Differenz, owner-scoped), analog zu PROJ-9/PROJ-6.
- Eigene lokale `laufendesWirtschaftsjahr`-Logik (kein Import aus
  `tax/perioden`), um Kopplung an parallel entwickelte Module zu vermeiden.
- `dynamic = "force-dynamic"` auf der Seite: Kennzahlen sollen den aktuellen
  Stand zeigen (sichtbarer Aktualitäts-Zeitstempel statt Caching).

### Qualität
- `npx tsc --noEmit`: keine Fehler in den Dashboard-Dateien. (Vorbestehende
  Fehler in `src/app/api/export/route.ts` und `src/lib/validation/export.ts`
  gehören zu PROJ-11 und liegen außerhalb dieser Datei-Grenzen.)
- `npx eslint src/lib/dashboard "src/app/api/dashboard" src/components/dashboard "src/app/(app)/dashboard"`:
  0 Fehler / 0 Warnungen.
- Tests: 16/16 grün (`vitest run src/lib/dashboard`).

### Offene Punkte / Hinweise für QA
- Acceptance-Kriterien voraussichtlich erfüllt; visuelle/E2E-Prüfung steht
  aus (Login → Dashboard, Leerzustand, Fehler-Sync-Hinweis, Sprungziele).
- Vorbestehende PROJ-11 tsc-Fehler blockieren einen globalen `tsc`/Build;
  liegen außerhalb der PROJ-12-Datei-Grenzen und sind hier nicht behoben.

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
