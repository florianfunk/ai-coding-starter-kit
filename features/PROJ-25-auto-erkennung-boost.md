# PROJ-25: Auto-Erkennung Boost (Cache-Default, Konsens-Konfidenz, LLM-Ausfall-Fallback)

## Status: Approved
**Created:** 2026-06-23
**Last Updated:** 2026-06-23
**Priorität:** P1

> **Verifikation 2026-06-23:** `npm test` → 832 grün (48 Files, +20 neu),
> `tsc --noEmit` → 0 Fehler, `npm run lint` → 0 Fehler, `npm run build` →
> Compiled successfully. AC1–AC7 erfüllt.
>
> **QA 2026-06-23 (Quentin, QA Backend): APPROVED — deploybar.** AC1–AC6/AC8
> code-verifiziert PASS, 332 Classifier-Tests grün, keine kritischen Issues,
> kein Sicherheitsproblem (Owner-Scope gewahrt, keine IDOR-Fläche). Zwei
> dokumentierte Randfall-Hinweise: W1 (Ausfall-Fallback zählt als `via_ki`,
> wahre Quelle im Audit `fallback_quelle` — bewusst, jetzt im Code kommentiert),
> W2 (Konsens-Boost auf Default-Kategorie — sehr enger Randfall, vertretbar).
>
> **Offen vor Deploy:** Migration 0016 muss eingespielt werden.

## Beschreibung
Phase-1-Quick-Wins zur Erhöhung der autonomen Klassifizierungsquote, damit die
Prüfliste **erst gar nicht so voll wird**. Drei rein in der Klassifizierungs-
Pipeline gekapselte, voll unit-testbare Hebel (kein Schema-/RLS-Eingriff) plus
ein UX-Quick-Win:

1. **Cache-Default nutzen (toter Hebel aktivieren):** `letzte_klassifikation_default`
   wird heute beim Cache-Hit GESCHRIEBEN, aber NIE GELESEN. Beim Cache-Hit eines
   `quelle='manuell'`-Eintrags wird die gemerkte Klassifikation deterministisch
   übernommen (analog Vorjahres-Pass) — kein LLM-Call. Bei `quelle='llm'`/`'web'`
   fließt sie als starker Hinweis in den LLM-Prompt.
2. **Konsens-Konfidenz-Boost:** Stimmen LLM-Kategorie, Historie-Mehrheitskategorie
   und Cache-Default überein, wird die LLM-Konfidenz angehoben (gedeckelt 1.0).
   Hebt grenzwertige Fälle (0.78–0.84) mit klarem Konsens über die Schwelle →
   weniger Prüfliste ohne Genauigkeitsverlust. (Nutzerwunsch: "aggressiver
   auto-verbuchen".)
3. **LLM-Ausfall-Fallback:** Fällt das LLM aus (Provider-5xx), wird statt einer
   leeren Prüflisten-Buchung auf einen eindeutigen Cache-Default oder eine klare
   Historie-Mehrheit zurückgegriffen (vorausgefüllt, mit Quelle-Markierung).
   Verhindert Prüflisten-Flut bei API-Hängern.
4. **Klickbare Dashboard-KPIs (UX):** `StatBlock`-`href`-Prop aktivieren →
   KPI → gefilterte Detailliste in einem Klick. (Adressiert Pain Point "Suchen".)

## Kontext / Herkunft
Aus dem Team-Audit am 2026-06-23 (Bruno V1–V3, Mira UX) + Nutzer-Interview:
monatlich/Desktop/Batch, will maximale Automatik, Pain Points Prüfliste + Suchen.
Siehe Memory `tool-analyse-2026-06` und `nutzer-arbeitsweise-prioritaeten`.

## User Stories
- Als Inhaber möchte ich, dass ein Empfänger, den ich einmal manuell korrigiert
  habe, beim nächsten Vorkommen automatisch wieder so verbucht wird, ohne dass
  das LLM erneut entscheidet.
- Als Inhaber möchte ich, dass Buchungen mit klarem Signal-Konsens (LLM +
  Historie + Cache einig) auto-verbucht werden, auch wenn die reine
  LLM-Konfidenz knapp unter der Schwelle liegt.
- Als Inhaber möchte ich, dass bei einem KI-Ausfall bekannte Empfänger trotzdem
  vorbelegt werden, statt dass meine Prüfliste mit Bekanntem überschwemmt wird.
- Als Inhaber möchte ich auf dem Dashboard direkt von einer Kennzahl in die
  gefilterte Detailliste springen können.

## Acceptance Criteria
- [x] **AC1 — Cache-Default deterministisch:** Cache-Hit mit `quelle='manuell'`
  und gesetztem `letzte_klassifikation_default` → 1:1 Übernahme (quelle='cache'),
  kein LLM-Call. Ausreißer-Limit gilt wie überall (→ zur Prüfung).
- [x] **AC2 — Cache-Default als LLM-Hinweis:** Cache-Hit mit `quelle='llm'`/`'web'`
  und gesetztem Default → Default fließt als Hinweis in den LLM-Prompt
  (übersteuert die LLM-Entscheidung nicht hart).
- [x] **AC3 — Konsens-Boost:** Wenn LLM-Kategorie == Historie-Mehrheitskategorie
  == Cache-Default-Kategorie (alle gesetzt & gleich), wird die Konfidenz um einen
  festen Betrag angehoben (Default +0.1, Deckel 1.0). Greift NICHT, wenn eines
  der Signale fehlt oder abweicht. Audit hält Boost fest.
- [x] **AC4 — LLM-Ausfall-Fallback:** llm===null UND (eindeutiger Cache-Default
  ODER Historie-Mehrheit ≥80 % bei ≥3) → Buchung wird mit diesem Wert vorbelegt
  (Status bleibt `zur_pruefung`, aber mit ausgefüllter Kategorie + Quelle-Marker),
  statt leer. Kein Default vorhanden → bisheriges Verhalten (leer zur Prüfung).
- [x] **AC5 — Reihenfolge:** Regeln → Vorjahres-Pass → **Cache-Default-Pass (neu)**
  → LLM. Regeln und Vorjahr behalten Vorrang.
- [x] **AC6 — Reproduzierbar & testbar:** Alle Entscheidungslogik in reinen
  Funktionen, mit Unit-Tests. Bestehende Tests bleiben grün.
- [x] **AC7 — Dashboard-KPIs klickbar:** Die Haupt-KPIs verlinken auf die jeweils
  gefilterte Detailliste; Hover-Affordance sichtbar. (Betriebseinnahmen/-ausgaben
  → `/kategorien-analyse`; Gewinn/USt waren bereits verlinkt.)
- [x] **AC8 — Minimaler Schema-Eingriff (angepasst):** Nutzt vorhandene Spalten
  (`letzte_klassifikation_default`, Historie-Aggregat). **Entscheidung 2026-06-23:**
  `quelle='cache'` wird als eigene Provenienz auf die Buchung geschrieben (sichtbar
  im Ledger/Statistik, nicht in Audit versteckt) → eine minimale Migration 0016
  erweitert die CHECK-Constraint `buchung_quelle_check` um `'cache'` — identisch
  zum erprobten Vorjahr-Präzedenzfall (Migration 0013). Keine neue Spalte/Tabelle/RLS.

## Out of Scope (spätere Phasen)
- MCC/Gegen-IBAN-Signale (Schema-Migration) → eigenes Feature.
- Few-Shot aus Korrekturen, Batch-LLM, Normalisierungs-Clustering.
- Prüflisten-Speedrun (Keyboard-Triage, Gruppierung) → Phase 2.
- Cockpit-Dashboard, Command-Palette, Fristen-Countdown → Phase 3.

## Implementation Notes

### Umgesetzt (Backend, TDD) — 2026-06-23
AC1–AC6 in der Klassifizierungs-Pipeline implementiert (Backend-Workstream).
AC7 (Dashboard-KPIs) separat im Frontend umgesetzt: `StatBlock` unterstützte
`href` bereits voll (rendert als Link mit Hover); die KPIs Betriebseinnahmen
und Betriebsausgaben in `src/components/dashboard/dashboard-editorial.tsx`
verlinken jetzt auf `/kategorien-analyse` (Gewinn → `/euer`, USt →
`/ust-voranmeldung` waren schon verlinkt). Bewusst NICHT auf `/buchungen?richtung=…`
verlinkt, weil die Buchungsseite serverseitig nur konto/von/bis filtert — ein
richtung/klassifikation-Param würde ins Leere laufen.

- **AC5 Reihenfolge:** Regeln → Vorjahres-Pass → **Cache-Default-Pass (neu)** →
  LLM. Cache-Pass liegt in `klassifiziereBuchung` direkt nach dem Cache-Lookup
  (`src/lib/classifier/pipeline.ts`, Block "(2b)").
- **AC1 Cache-Default deterministisch:** Neue reine Fn
  `entscheideCacheUebernahme(buchung, letzteKlassifikation, config)` setzt
  `quelle='cache'`, beachtet das Ausreißer-Limit (→ zur Prüfung), sonst
  auto_verbucht/konfidenz=1, Audit `cache_uebernahme: true`. Greift nur bei
  `kenntnis.quelle==='manuell'` + gültigem Cache + gesetztem Default. Kein LLM.
- **AC2 Cache-Default als LLM-Hinweis:** Bei `quelle==='llm'/'web'` wird ein
  weicher Hinweis gebaut und über das neue Feld `cache_default_hinweis`
  (`LlmEingabe` in `src/lib/classifier/llm.ts`) in den Prompt gegeben — kein
  hartes Übersteuern.
- **AC3 Konsens-Boost:** `entscheideBuchung` hat einen neuen optionalen
  Parameter `signale: EntscheidungsSignale`. Bei LLM-Kat == Historie-Mehrheits-
  Kat == Cache-Default-Kat → `min(1.0, konfidenz + KONSENS_BOOST)` (0.1).
  Geboostete Konfidenz steuert das Schwellwert-Routing; Audit `konsens_boost`.
- **AC4 LLM-Ausfall-Fallback:** Im `!llm`-Zweig wird über
  `ermittleAusfallVorbelegung(signale)` vorbelegt (Cache-Default vor Historie
  ≥80 %/≥3). Status bleibt `zur_pruefung`, Audit `fallback_quelle`.
- **AC6 reproduzierbar:** Alles in reinen Funktionen, 20 neue Unit-/Integrations-
  Tests in `pipeline.test.ts`. `npx vitest run src/lib/classifier/` → 332 grün,
  `npx tsc --noEmit` → 0 Fehler.

### Abweichung zu AC8 (Kein Schema-Eingriff)
`quelle='cache'` wird auf die Buchung geschrieben. Die CHECK-Constraint
`buchung_quelle_check` erlaubte bisher nur `regel|ki|manuell|vorjahr` (Migration
0013). Ohne Erweiterung würde JEDER Cache-Treffer beim UPDATE scheitern (exakt
der PROJ-23-Hänger-Bug). Daher minimale **Migration 0016**
(`supabase/migrations/0016_buchung_quelle_cache.sql`) — eine Zeile, nur die
CHECK-Constraint um `'cache'` erweitert, keine neue Spalte/Tabelle/RLS. Diese
Migration MUSS vor dem Deploy eingespielt werden.

### Geänderte/Neue Dateien
- `src/lib/classifier/pipeline.ts` — quelle-Union um `'cache'`, `KONSENS_BOOST`,
  `EntscheidungsSignale`, `entscheideCacheUebernahme`, `ermittleAusfallVorbelegung`,
  Cache-Default-Pass + Signal-Durchreichung.
- `src/lib/classifier/llm.ts` — `cache_default_hinweis` (LlmEingabe + Prompt-Block).
- `src/app/api/klassifizierung/route.ts` — `via_cache`-Zähler + 'cache'-Branch.
- `src/lib/classifier/pipeline.test.ts` — 20 neue Tests (AC1–AC4).
- `supabase/migrations/0016_buchung_quelle_cache.sql` — CHECK-Constraint-Erweiterung.
