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
- [x] **AC1 — Begrenzte Nebenläufigkeit:** Die pro-Buchung-Verarbeitung läuft
  mit einem festen Concurrency-Limit (Default sinnvoll, z. B. 5; per ENV
  override-bar). Reiner Worker-Pool-Helfer (z. B. `mapMitLimit`) ist
  unit-getestet (hält Limit ein, verarbeitet alle Items, Reihenfolge der
  Ergebnisse stabil/zuordenbar).
- [x] **AC2 — Korrektheit unverändert:** Für eine gegebene Eingabemenge ist das
  Klassifikationsergebnis (pro Buchung) identisch zum seriellen Lauf
  (deterministische Pässe, gleiche Schwellen). Test belegt Gleichheit
  seriell vs. parallel für denselben Input.
- [x] **AC3 — InflightMap unter Last:** Bei N Buchungen mit demselben
  unbekannten Empfänger wird weiterhin genau EIN Recherche-/Cache-Fill-Call
  geteilt (kein Thundering Herd durch Parallelität). Test belegt das.
- [x] **AC4 — Zähler atomar:** Alle Ergebniszähler stimmen nach einem parallelen
  Lauf exakt (Summe == Anzahl verarbeiteter Buchungen; keine Doppel-/
  Verlustzählung). Test belegt das.
- [x] **AC5 — Zeitbudget & sauberer Abbruch:** `ZEIT_BUDGET_MS` greift weiter;
  bei Erreichen werden keine neuen Tasks gestartet, laufende sauber zu Ende
  geführt oder verworfen ohne halben DB-Schreibzustand pro Buchung;
  `verbleibend` korrekt. (manuell_bestaetigt bleibt unangetastet.)
- [x] **AC6 — Rate-Limit-Schonung:** Concurrency-Limit konservativ; bei
  LLM-Fehlern/Rate-Limit greift weiter der bestehende Ausfall-Fallback
  (Historie-Vorbelegung / Prüfliste), kein Job-Crash.
- [x] **AC7 — Keine Regression:** tsc 0, build ok, alle bestehenden Tests grün.
  Konsistenz-Pass, manuell_bestaetigt-Schutz, Split-Regeln unverändert. Kein
  Schema/Migration.

## Implementation Notes

### Was gebaut wurde
- **Neuer Worker-Pool-Helfer** `src/lib/util/map-mit-limit.ts` (`mapMitLimit`):
  reiner, getesteter Helfer ohne npm-Dependency. Garantien:
  - Nie mehr als `limit` Worker gleichzeitig (Runner-Pool-Muster; `runnerCount
    = min(limit, n)` Runner ziehen Items aus einem gemeinsamen, synchron
    inkrementierten Index).
  - Ergebnisse **index-stabil** zur Eingabe (`ergebnisse[i]` ↔ `items[i]`),
    unabhängig von der Fertigstellungs-Reihenfolge.
  - Optionaler `sollAbbrechen`-Hook: wird VOR dem Start jedes Items geprüft →
    keine neuen Tasks mehr starten, laufende sauber zu Ende führen
    (Zeitbudget). Rückgabe enthält `gestartet` und `abgebrochen`.
  - Worker-Fehler propagiert nach Drain (kein verwaister Worker), wird aber im
    Job-Aufrufer durch das per-Buchung-try/catch faktisch nie ausgelöst.
- **route.ts umgestellt:** Die strikt serielle `for`-Schleife wurde durch
  `mapMitLimit(buchungen, concurrency, worker, { sollAbbrechen })` ersetzt.
  Jeder Task verarbeitet GENAU eine Buchung (`klassifiziereBuchung` → DB-Update
  inkl. `split_angewandt`-Sonderfall + `.neq('status','manuell_bestaetigt')`-
  Schutz → Audit-Insert) und liefert ein in sich abgeschlossenes
  `TaskErgebnis` (Zählerbeiträge: verarbeitet/auto_verbucht/quelle/regel_id,
  bzw. `uebersprungen_manuell` oder `fehler`).

### Concurrency-Limit
- Default **5**, ENV-Override über **`KLASSIFIZIERUNG_CONCURRENCY`**.
- `ermittleConcurrency()` klemmt auf `[1, 20]`; nicht-numerische/leere Werte →
  Default 5. Konservativ wegen Anthropic-Rate-Limits.

### Zähler-Atomarität
- **Keine geteilten Zähler-Mutationen im Worker.** Jeder Task gibt sein
  Teil-Ergebnis zurück; die Aggregation zu `ergebnis.*` passiert
  **deterministisch nach** `mapMitLimit` in einer einzigen, await-freien
  Schleife über `teilErgebnisse`. Da JS single-threaded ist und die Aggregation
  keine await-Punkte hat, gibt es keine verlorenen/doppelten Increments —
  unabhängig vom Interleaving der Worker. (Robusteste der in der Aufgabe
  genannten Varianten.)
- `regelTreffer`-Map wird ebenfalls erst in der Aggregation befüllt; die
  `lernregel.treffer_zaehler`-Updates laufen unverändert danach.

### Zeitbudget & Abbruch
- `sollAbbrechen: () => Date.now() - startMs > ZEIT_BUDGET_MS` wird vom
  Worker-Pool VOR jedem neuen Task-Start geprüft. Bereits gestartete Tasks
  schreiben vollständig (kein halber DB-Zustand pro Buchung); nicht gestartete
  Buchungen bleiben `offen`.
- `verbleibend = buchungen.length - gestartet`; bei `> 0` →
  `zeitlimit_erreicht = true`. `verarbeitetGesamt` (Job-`fortschritt`) bleibt
  über `buchungen.length - (verbleibend ?? 0)` == `gestartet` konsistent.
- Fortschritt wird nicht mehr "alle 10 Zeilen" gepflegt (an seriellen Index
  gekoppelt war unter Nebenläufigkeit nicht mehr sinnvoll), sondern einmal
  final auf `gestartet` gesetzt. Der Job ist erst nach Rückkehr `fertig`.

### InflightMap (Race-Schutz) — verifiziert, keine Härtung nötig
- Die bestehende job-scoped `InflightMap` in `pipeline.ts` speichert das
  Recherche-Promise **bevor** es awaited wird (`inflight.set(key, promise)` vor
  `await promise`). Der `has`/`get`/`set`-Block ist synchron (keine await-Punkte
  dazwischen) → unter dem JS-Event-Loop teilen sich N gleichzeitige Tasks mit
  demselben Empfänger garantiert genau EIN `recherchiereUndUpserte`-Promise.
  Kein Thundering Herd. Mit einem 25-Buchungen-Test (`concurrency=5`,
  delayed Recherche) belegt: genau 1 Recherche- und 1 Extraktions-Call.

### LLM-Ausfall / Rate-Limit (AC6)
- Unverändert: `klassifiziereBuchung` fängt `LlmKlassifiziererError` ab und
  liefert über `entscheideBuchung` die Ausfall-Vorbelegung (Cache/Historie) bzw.
  `zur_pruefung`. Da jeder Task sein eigenes try/catch hat, crasht ein
  LLM-/Rate-Limit-Fehler weder den Task noch den Job.

### Tests
- `src/lib/util/map-mit-limit.test.ts` — 11 Tests: Limit-Einhaltung,
  Index-Stabilität bei umgekehrter Fertigstellung, limit>items, leere Liste,
  limit<1→1, `sollAbbrechen` (früher Stopp + sofortiger Abbruch), Fehler-
  Propagation, per-Item-try/catch-Muster, 100-Item-Stresstest.
- `src/lib/classifier/pipeline-parallel.test.ts` — 3 Tests: AC2 (seriell ==
  parallel), AC3 (25 gleiche Empfänger → 1 Call), AC4 (Zählersummen exakt).
- Bestehende `pipeline.test.ts`-Inflight-Test bleibt grün.

### Abschluss-Checks
- `npx tsc --noEmit`: 0 Fehler.
- `npm run build`: erfolgreich (Compiled successfully).
- `npm run lint`: 0 Errors (nur vorbestehende Warnings in unrelated Dateien).
- `npm test`: 898 grün (+ 1 skipped). 1 vorbestehender Flake in
  `web-research.test.ts` (5000ms-Timeout unter paralleler Suite-Last) — läuft
  isoliert grün und ist von PROJ-33 nicht berührt.

### Kein Schema/Migration. Keine neue npm-Dependency.

### Hinweise für den Agenten
- Aktueller Bottleneck: `for`-Schleife ab ~Zeile 420 in
  `src/app/api/klassifizierung/route.ts` (`await klassifiziereBuchung` + danach
  `supabase.update`). DB-Update pro Buchung ist Teil des Tasks.
- KEIN neues npm-Dep nötig (kleiner eigener `mapMitLimit` reicht; p-limit nur
  wenn bewusst gewünscht). Bevorzugt eigener, getesteter Helfer.
- Concurrency konservativ (Anthropic-Rate-Limits): Default 5, ENV-override.
- Der Konsistenz-Pass läuft NACH allen Tasks — Barriere bleibt erhalten.
