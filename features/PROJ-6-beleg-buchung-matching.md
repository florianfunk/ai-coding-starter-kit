# PROJ-6: Beleg↔Buchung-Auto-Matching & Fehlliste

## Status: In Progress
**Created:** 2026-05-15
**Last Updated:** 2026-05-15

## Dependencies
- Requires: PROJ-5 (Autonome Klassifizierung) — liefert die als geschäftlich klassifizierten Buchungen
- Requires: PROJ-3 (Paperless-Integration) — liefert die abzugleichenden Belege

## Beschreibung
Gleicht jede als geschäftlich/steuerrelevant klassifizierte Kontobuchung automatisch mit den importierten Paperless-Belegen ab (Betrag, Datum, Empfänger/Korrespondent, Textähnlichkeit). Ergebnis ist eine belastbare Zuordnung sowie eine **Fehlliste**: Geschäftsbuchungen ohne Beleg (Belegnachforderung) und Belege ohne zugehörige Buchung.

## User Stories
- Als Inhaber möchte ich, dass jede Geschäftsbuchung automatisch einem Paperless-Beleg zugeordnet wird, damit Buchung und Nachweis verknüpft sind.
- Als Inhaber möchte ich eine Liste aller Geschäftsbuchungen ohne Beleg sehen, damit ich gezielt fehlende Belege nachreichen kann.
- Als Inhaber möchte ich eine Liste aller Belege ohne passende Buchung sehen, damit ich vergessene/fehlende Kontobewegungen finde.
- Als Inhaber möchte ich unsichere Matches bestätigen oder verwerfen können, damit die Zuordnung korrekt ist.
- Als Inhaber möchte ich für eine fehlende Zuordnung manuell einen Beleg zuordnen können, damit Sonderfälle abgedeckt sind.

## Acceptance Criteria
- [ ] Auto-Match je Buchung gegen Belege über gewichtete Kriterien: Betrag (exakt/Toleranz), Datum (±Fenster), Empfänger/Korrespondent, Textähnlichkeit
- [ ] Eindeutige Treffer werden automatisch verknüpft; mehrdeutige/schwache Treffer als „unsicher" markiert (Input für Prüfliste PROJ-7)
- [ ] Fehlliste A: alle geschäftlichen Buchungen ohne zugeordneten Beleg, sortier-/filterbar nach Zeitraum/Konto/Betrag
- [ ] Fehlliste B: alle Belege ohne zugeordnete Buchung
- [ ] Manuelle Zuordnung/Aufhebung einer Beleg-Buchung-Verknüpfung möglich; manuelle Zuordnungen sind vor Re-Matching geschützt
- [ ] Ein Beleg kann ggf. mehreren Teilbuchungen zugeordnet werden (z.B. Sammelrechnung) und umgekehrt (Ratenzahlung)
- [ ] Re-Matching nach neuem Paperless-Sync oder Kontoimport aktualisiert nur offene Fälle, nicht bestätigte Zuordnungen
- [ ] Matching-Ergebnis ist nachvollziehbar (welche Kriterien mit welchem Score zum Treffer führten)

## Edge Cases
- Was passiert bei Teilzahlungen/Raten zu einer Rechnung (1 Beleg ↔ mehrere Buchungen)?
- Was passiert bei Sammelrechnungen (mehrere Belege ↔ 1 Buchung)?
- Wie wird mit Beträgen umgegangen, die sich durch Gebühren/Skonto leicht unterscheiden? (Toleranzfenster)
- Wie werden zeitliche Abweichungen behandelt (Rechnungsdatum vs. Zahlungsdatum, oft Wochen auseinander)?
- Was passiert bei mehreren Belegen mit identischem Betrag im selben Zeitraum? (alle als „unsicher", Nutzerauswahl)
- Wie wird mit Fremdwährungsdifferenzen aus PROJ-4 umgegangen?
- Was passiert mit privat klassifizierten Buchungen? (kein Beleg-Soll, nicht in Fehlliste A)

## Technical Requirements
- Genauigkeit: konfigurierbare Toleranzen (Betrag/Datum) zur Minimierung von Falsch-Matches
- Stabilität: bestätigte/manuelle Zuordnungen überleben Re-Matching
- Nachvollziehbarkeit: Match-Score und Kriterien einsehbar

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

> Siehe `docs/ARCHITECTURE.md` für den Gesamtkontext.

### Backend-Bedarf: Ja (serverseitiger Matching-Algorithmus + DB)
Gewichteter Abgleich über alle Belege/Buchungen → serverseitig, DB-gestützt.

### Komponentenstruktur
```
Abgleich (/abgleich)
+-- Tab "Buchungen ohne Beleg" (Fehlliste A) — filter-/sortierbar
+-- Tab "Belege ohne Buchung" (Fehlliste B)
+-- Tab "Unsichere Matches" — bestätigen/verwerfen
+-- Manuelle Zuordnung (shadcn command/dialog: Beleg ↔ Buchung suchen & verknüpfen)
+-- "Re-Matching starten"-Aktion
```

### Datenmodell (Klartext)
**Beleg-Buchung-Zuordnung**: Beleg-Ref, Buchungs-Ref, Match-Score, beigetragene Kriterien (Betrag/Datum/Empfänger/Text), Status (auto/manuell/unsicher), gesperrt-Flag (manuell = vor Re-Matching geschützt). N:M (Sammelrechnung/Raten).

### Tech-Entscheidungen (Begründung)
- **Gewichtetes Scoring (`lib/matching/`):** Betrag exakt/Toleranz, Datumsfenster, Empfänger-/Korrespondent-Ähnlichkeit, Textähnlichkeit.
- **Konfigurierbare Toleranzen (Betrag/Datum):** Skonto/Gebühren, Rechnungs- vs. Zahlungsdatum.
- **Eindeutig → auto, mehrdeutig → unsicher (Prüfliste):** minimiert Falsch-Matches.
- **Gesperrte manuelle Zuordnungen überleben Re-Matching.**

### Abhängigkeiten (Pakete)
Keine neuen (eigene Scoring-Logik).

### Edge-Case-Behandlung
Teilzahlungen/Raten (1 Beleg ↔ n Buchungen) und Sammelrechnungen (n ↔ 1) via N:M; Betragstoleranz für Skonto/Gebühren; Datumsfenster; gleicher Betrag mehrfach → alle „unsicher"; private Buchungen ohne Beleg-Soll (nicht in Fehlliste A).

## Implementierungsnotizen

**Stand:** In Progress (Frontend + Backend implementiert, QA ausstehend)

### Gebaute Dateien
- `src/lib/matching/score.ts` — reine, testbare Scoring-Funktion `bewerteMatch()`.
  Gewichtetes Scoring (Default: Betrag 0,45 / Datum 0,20 / Empfänger 0,20 /
  Text 0,15; Gewichte werden auf Summe 1 normalisiert → Score garantiert in
  [0,1]). Betragstoleranz konfigurierbar (Default absolut 0,50 € ODER relativ
  2 %, der größere Wert gewinnt; |Betrag| beidseitig → Vorzeichen egal).
  Datumsfenster (Default ±14 Tage, voller Score bis halbes Fenster, danach
  linearer Abfall). Empfänger/Korrespondent: deutsche Umlaut-Transliteration
  (ä→ae, ö→oe, ü→ue, ß→ss) + Teilstring-Bonus + Token-Jaccard. Textähnlichkeit:
  Overlap-Koeffizient Verwendungszweck vs. Titel/Korrespondent/OCR (OCR auf
  2000 Zeichen gekappt). Schwellen: ≥0,85 eindeutig, 0,5–0,85 unsicher,
  <0,5 kein Match. KEINE externen Pakete.
- `src/lib/matching/engine.ts` — `fuehreMatchingAus()` orchestriert rein
  in-memory: nur `klassifikation='geschaeftlich'` wird gematcht (privat/
  neutral/unklar/null → ignoriert, kein Beleg-Soll). Bester Treffer mit
  Vorsprung ≥0,1 vor Zweitbestem UND ≥0,85 → `auto`. Mehrdeutig/unsicher-Band
  → alle plausiblen Kandidaten als `unsicher` (Nutzerauswahl). Gesperrte
  (manuelle) Zuordnungen → Buchung komplett übersprungen (überlebt Re-Match).
  N:M zulässig.
- `src/lib/matching/validation.ts` — Zod-Schemas (Re-Matching-Body,
  Fehllisten-Filter, manuelle Zuordnung anlegen/löschen). Liegt bewusst in
  `lib/matching/` (Datei-Grenzen).
- `src/app/api/abgleich/route.ts` — POST Re-Matching (job_lauf art='matching',
  Doppelstart-Schutz, gesperrte nie gelöscht/überschrieben, `nur_offen`
  steuert ob nur betroffene oder alle nicht-gesperrten neu gerechnet werden).
  GET Fehllisten A/B + unsichere Matches + `?status=1` Polling. Query-Filter
  Zeitraum/Konto/Betrag. getApiUser→401, owner-scoped, Zod vor DB.
- `src/app/api/abgleich/zuordnung/route.ts` — POST manuelle Zuordnung /
  unsicheren Match bestätigen (→ manuell, gesperrt) bzw. verwerfen; DELETE
  Zuordnung aufheben. Beleg-/Buchungs-Ownership wird zusätzlich geprüft.
- `src/app/(app)/abgleich/page.tsx` + `src/components/abgleich/*` —
  Server-Page lädt Kontext, Client-Ansicht mit Tabs (Buchungen ohne Beleg /
  Belege ohne Buchung / Unsichere Matches), Re-Matching-Button + Job-Polling,
  Filterleiste, manuelle Zuordnung via shadcn Command/Dialog, Score- und
  Kriterien-Breakdown via Popover. Nur shadcn/ui, Deutsch, Lade-/Fehler-/
  Leerzustände.
- Tests: `score.test.ts` (24) + `engine.test.ts` (12) = **36 Tests, alle grün**
  (Betragstoleranz, Datumsfenster, eindeutig vs. unsicher, gesperrt überlebt
  Re-Match, private/neutrale/unklare Buchung ignoriert, N:M Raten/Sammel-
  rechnung, Vorsprung-Logik, Score-Bounds, Nachvollziehbarkeit).

### Qualität
- `npx tsc --noEmit` → 0 Fehler.
- `npx eslint` (matching/abgleich) → 0 Fehler/Warnungen.
- `npx vitest run src/lib/matching` → 36/36 grün.

### Deviationen / Hinweise
- Validierungs-Schemas in `src/lib/matching/validation.ts` statt
  `src/lib/validation/` (Datei-Grenzen der parallelen Arbeit).
- Re-Matching läuft synchron im Request (MVP-Muster wie PROJ-5),
  `maxDuration=300`. Bei sehr großen Datenmengen später Hintergrund-Queue.
- Token-Overlap-Heuristik bewusst einfach gehalten (kein Fuzzy-Paket); für
  typische deutsche Buchungstexte/Belegtitel ausreichend trennscharf.
- Offene Punkte für QA: Verhalten bei sehr vielen identischen Beträgen im
  selben Zeitraum (alle als unsicher gelistet, Nutzerauswahl) end-to-end mit
  echten Daten prüfen; Fremdwährungsdifferenzen aus PROJ-4 (derzeit nur
  Betragsabsolutwert, keine Kursumrechnung).

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
