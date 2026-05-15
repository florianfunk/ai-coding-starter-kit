# PROJ-10: Einkommensteuer-Vorschau & Privatentnahmen-Aufstellung

## Status: In Progress
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

## Implementierungsnotizen

**Stand:** In Progress (Backend + Frontend implementiert, deterministisch, getestet)

### Gebaute Dateien
- `src/lib/tax/est.ts` — reine deterministische ESt-Rechnung nach §32a EStG.
  Tarif als gestaffelte Zonen (`null`/`progression`/`linear`) modelliert; die
  amtliche Progressionsformel `(a·y+b)·y+d` mit `y=(zvE−basis)/10000` und die
  linearen Spitzenzonen (42 % / 45 %). Splitting (Zusammenveranlagung): Tarif
  auf abgerundetes halbes zvE, ×2 (§32a Abs.5). zvE wird vor Tarifanwendung
  auf volle Euro abgerundet (§32a Abs.1 S.5). Soli mit Freigrenze **und**
  gesetzlicher Milderungszone (11,9 %), bei Zusammenveranlagung verdoppelte
  Freigrenze. Verlust → Steuer 0 + Hinweis. Effektiv-/Grenzsteuersatz
  (Grenzsatz = analytische Tarifableitung). Cent-genaue Rundung (lokale
  `rundeCent`, gleiche Semantik wie `euer.ts`, KEIN Cross-Import um
  Race-Conditions zu vermeiden). Seed-Konstanten **2024** (GF 11.604 €) und
  **2025** (GF 12.096 €) als Fallback inkl. `seedTarif()` mit
  „zuletzt-bekannt"-Logik. Zonen-Stetigkeit an allen Grenzen numerisch
  verifiziert.
- `src/lib/tax/est.test.ts` — 22 Vitest-Tests (Ziel war ≥ 12): Nullzone,
  Progressionszonen 2/3, Spitzensteuer 42 %/45 %, Splitting Einzel vs.
  Zusammen, Soli unter/über Freigrenze + verdoppelte Freigrenze bei
  Zusammenveranlagung, Verlust→0, Effektiv < Grenzsatz, weitere Einkünfte,
  Euro-Abrundung, Cent-Genauigkeit, Abschlusszahlung/Erstattung, Seed-/
  Fallback-Verhalten, `rundeCent`. Alle grün.
- `src/lib/validation/est.ts` — Zod `estVorschauSchema` (jahr Pflicht;
  veranlagung/weitere_einkuenfte/vorauszahlungen mit Defaults; Vorauszahlungen
  ≥ 0; Plausibilitäts-Obergrenzen; `z.coerce` für URL-Strings).
- `src/app/api/steuer/est/route.ts` — GET. `getApiUser`→401, owner-scoped,
  Zod vor DB, `.limit()` auf allen Queries, `{error}`-JSON + HTTP-Codes.
  Nutzt **dieselbe** EÜR-Aggregation wie PROJ-9 durch Import von
  `berechneEuer`/`wirtschaftsjahrGrenzen`/`rundeCent` aus `lib/tax/euer`
  (euer.ts NICHT verändert). Bei abgeschlossenem WJ wird der eingefrorene
  Gewinn-Snapshot aus `steuerperiode` verwendet (Konsistenz zu PROJ-9), sonst
  on-the-fly. ESt-Tarif bevorzugt aus `est_tarif`-Stammdaten (mit
  Struktur-Validierung der `zonen`-jsonb), Fallback auf Seed + Warnung.
  Privatentnahmen = `buchung` mit `klassifikation='privat'` im WJ; PROJ-7-
  Splits nur mit `split_anteil` (Betrag×Anteil); Konto-/Kategorienamen ohne
  N+1 aufgelöst. Durchgängiger `disclaimer`-String im Response. Hinweis bei
  vorläufiger (nicht abgeschlossener) EÜR.
- `src/components/est/` — `typen.ts` (DTOs + Formatter), `est-disclaimer.tsx`
  (prominenter destructive Alert, in beiden Tabs oben fixiert),
  `privatentnahme-drilldown.tsx` (Sheet, Buchungsebene, Split-Anteil
  sichtbar), `est-ansicht.tsx` (Tabs „ESt-Vorschau"/„Privatentnahmen";
  Parameter-Formular; Kennzahlen-Karten Effektiv-/Grenzsatz/Soli;
  Privatentnahmen je Monat summiert mit Drill-down; Lade-/Fehler-/
  Leerzustände).
- `src/app/(app)/einkommensteuer/page.tsx` — Server Component, Jahr-Auswahl
  aus Buchungsbestand (analog EÜR-Seite). Route bereits in `layout.tsx`-Nav
  verlinkt.

### Konventionen / Qualität
- Nur shadcn/ui aus `src/components/ui/` (Tabs, Card, Select, Input, Button,
  Badge, Alert, Sheet, Table, ScrollArea, Skeleton). Tailwind only, responsive.
- `npx tsc --noEmit`: keine Fehler in PROJ-10-Dateien. (Vorbestehender,
  unabhängiger Fehler in `src/app/api/export/route.ts` = PROJ-12, außerhalb
  des Scopes, nicht angefasst.)
- `npx eslint` über alle PROJ-10-Pfade: 0 Fehler / 0 Warnungen.
- Tests: 22/22 grün. Kein `any`, deterministisch, keine KI, keine neuen Pakete.

### Annahmen / offene Punkte
- `est_tarif`-Tabelle ist im Schema vorhanden, aber i. d. R. ungeseedet →
  produktiv greift der Seed-Fallback (Warnung wird sichtbar angezeigt). Ein
  optionaler Seed/Backfill der `est_tarif`-Stammdaten ist bewusst NICHT Teil
  dieses Tickets (keine Migration angefasst).
- Soli-Milderungszone mit 11,9 % gemäß §4 SolzG abgebildet; Freigrenze als
  Stammdatum (Seed: 18.130 € / 2024, 19.950 € / 2025, Einzel).
- Vereinfachte Schätzung (keine Sonderausgaben/Freibeträge) — bewusst, durch
  durchgängigen Disclaimer abgesichert. Verbleibender QA-/Review-Schritt offen.

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
