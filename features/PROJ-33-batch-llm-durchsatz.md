# PROJ-33: Batch-LLM — Durchsatz der Klassifizierung

## Status: In Progress
**Created:** 2026-06-24
**Last Updated:** 2026-06-24
**Priorität:** P2

## Beschreibung
Hebel V7 aus der Team-Analyse. Die Klassifizierungs-Pipeline ruft das LLM heute
**streng seriell** auf (eine Buchung nach der anderen, `for`-Schleife mit
`await klassifiziereBuchung`). Das `ZEIT_BUDGET_MS` (210 s) deckelt damit die
Anzahl pro Lauf auto-klassifizierbarer Buchungen über die LLM-Latenz. Bei
großen Importen bleiben viele Buchungen `offen` und brauchen mehrere Läufe.

Dieses Feature parallelisiert die LLM-Aufrufe mit **begrenzter Nebenläufigkeit**
(Concurrency-Limit), um den Durchsatz pro Lauf deutlich zu erhöhen — ohne die
deterministische Korrektheit, die Idempotenz oder die Rate-Limits des
LLM-Providers zu verletzen.

## Scope (festgelegt)
- **Begrenzte Parallelisierung** der pro-Buchung-Verarbeitung im
  Klassifizierungs-Job (`src/app/api/klassifizierung/route.ts`): statt seriell
  ein Worker-Pool mit festem Concurrency-Limit (z. B. 4–6, konfigurierbar/ENV).
- **Korrektheit erhalten:** Regeln/Vorjahr/Cache/Few-Shot-Vorrang unverändert;
  die Reihenfolge-unabhängigen Pässe bleiben identisch. Der **Konsistenz-Pass**
  (läuft NACH der Schleife) bleibt unverändert.
- **Race-Schutz:** Die bestehende job-scoped `InflightMap` (geteilter
  Firecrawl-/Cache-Call für gleichen Empfänger) MUSS unter Nebenläufigkeit
  weiter korrekt sein (sie ist genau dafür da — verifizieren/ggf. härten).
- **Zeitbudget & Abbruch:** `ZEIT_BUDGET_MS` weiter respektieren; bei Erreichen
  sauber abbrechen, Rest bleibt `offen` (kein halber Schreibzustand pro Buchung).
- **Zähler/Audit:** alle Ergebniszähler (`auto_verbucht`, `via_ki`, `via_cache`,
  `verbleibend` …) bleiben unter Parallelität korrekt (atomar
  zusammengeführt, keine verlorenen Updates).

## Out of Scope
- Echtes Provider-seitiges Batch-API (Message-Batches) — hier
  Client-Concurrency, kein Anbieter-Batch-Endpoint.
- Änderung der Klassifikations-Logik selbst (nur Ausführungsmodell).
- Streaming/Teilergebnis-UI.

## User Stories
- Als Inhaber möchte ich, dass ein großer Import in einem Lauf möglichst
  vollständig klassifiziert wird, statt über viele Läufe verteilt.

## Acceptance Criteria
- [ ] **AC1 — Begrenzte Nebenläufigkeit:** Die pro-Buchung-Verarbeitung läuft
  mit einem festen Concurrency-Limit (Default sinnvoll, z. B. 5; per ENV
  override-bar). Reiner Worker-Pool-Helfer (z. B. `mapMitLimit`) ist
  unit-getestet (hält Limit ein, verarbeitet alle Items, Reihenfolge der
  Ergebnisse stabil/zuordenbar).
- [ ] **AC2 — Korrektheit unverändert:** Für eine gegebene Eingabemenge ist das
  Klassifikationsergebnis (pro Buchung) identisch zum seriellen Lauf
  (deterministische Pässe, gleiche Schwellen). Test belegt Gleichheit
  seriell vs. parallel für denselben Input.
- [ ] **AC3 — InflightMap unter Last:** Bei N Buchungen mit demselben
  unbekannten Empfänger wird weiterhin genau EIN Recherche-/Cache-Fill-Call
  geteilt (kein Thundering Herd durch Parallelität). Test belegt das.
- [ ] **AC4 — Zähler atomar:** Alle Ergebniszähler stimmen nach einem parallelen
  Lauf exakt (Summe == Anzahl verarbeiteter Buchungen; keine Doppel-/
  Verlustzählung). Test belegt das.
- [ ] **AC5 — Zeitbudget & sauberer Abbruch:** `ZEIT_BUDGET_MS` greift weiter;
  bei Erreichen werden keine neuen Tasks gestartet, laufende sauber zu Ende
  geführt oder verworfen ohne halben DB-Schreibzustand pro Buchung;
  `verbleibend` korrekt. (manuell_bestaetigt bleibt unangetastet.)
- [ ] **AC6 — Rate-Limit-Schonung:** Concurrency-Limit konservativ; bei
  LLM-Fehlern/Rate-Limit greift weiter der bestehende Ausfall-Fallback
  (Historie-Vorbelegung / Prüfliste), kein Job-Crash.
- [ ] **AC7 — Keine Regression:** tsc 0, build ok, alle bestehenden Tests grün.
  Konsistenz-Pass, manuell_bestaetigt-Schutz, Split-Regeln unverändert. Kein
  Schema/Migration.

## Implementation Notes
_(von den Agenten zu füllen)_

### Hinweise für den Agenten
- Aktueller Bottleneck: `for`-Schleife ab ~Zeile 420 in
  `src/app/api/klassifizierung/route.ts` (`await klassifiziereBuchung` + danach
  `supabase.update`). DB-Update pro Buchung ist Teil des Tasks.
- KEIN neues npm-Dep nötig (kleiner eigener `mapMitLimit` reicht; p-limit nur
  wenn bewusst gewünscht). Bevorzugt eigener, getesteter Helfer.
- Concurrency konservativ (Anthropic-Rate-Limits): Default 5, ENV-override.
- Der Konsistenz-Pass läuft NACH allen Tasks — Barriere bleibt erhalten.
