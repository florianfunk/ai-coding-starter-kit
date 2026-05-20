# PROJ-15: Klassifizierung-Pro — Empfänger-Cache, Regex- & Split-Regeln

## Status: In Progress
**Created:** 2026-05-20
**Last Updated:** 2026-05-20

## Dependencies
- Erweitert: PROJ-5 (Autonome Klassifizierung) — Pipeline + LLM-Prompt
- Erweitert: PROJ-7 (Prüfliste & Lernregeln) — Regel-Modell + UI
- Berührt: PROJ-13 (Adminbereich) — neuer Menüpunkt „Empfänger-Wissen"

## Beschreibung
Die autonome Klassifizierung aus PROJ-5 erreicht heute eine gute Trefferquote,
aber die **erste Erkennung** unbekannter Empfänger ist noch unscharf. Dieses
Feature setzt an vier Hebeln gleichzeitig an:

1. **Empfänger-Normalisierung** — Payment-Provider-Präfixe (`STRIPE*`, `PADDLE.NET*`,
   `PAYPAL *`), Rechtsformen und Whitespace werden vor jeder Klassifizierung
   vereinheitlicht. „STRIPE\*ACME LTD" und „Acme Ltd. (Berlin)" sind danach
   derselbe Empfänger. Macht alle nachgelagerten Schritte (Regeln, Cache,
   Historie) deutlich treffsicherer.
2. **Empfänger-Kenntnis-Cache** — eine neue Tabelle `empfaenger_kenntnis` mit
   dem normalisierten Namen als Schlüssel. Beim ersten Vorkommen eines
   geschäftlichen Empfängers wird über Firecrawl genau ein Web-Lookup
   ausgelöst (Branche, Leistung, 3 Snippets). Ergebnis wird gecached und steht
   ab dem nächsten Treffer als LLM-Kontext zur Verfügung — **kein zweiter
   Web-Call pro Empfänger**.
3. **Regex-Bedingungen in Lernregeln** — heute sind Regelbedingungen reine
   Substring-Matches. Mit Regex (`^STRIPE\*.*` für alle Stripe-Provider) wird
   das Regelsystem deutlich ausdrucksstärker. Inkl. ReDoS-Schutz über einen
   statischen Linter + 200-Zeichen-Limit.
4. **Split-Aktionen in Regeln** — `aktion.split` erlaubt z. B. „Handy-Vertrag
   immer 70 % geschäftlich, 30 % privat". Die Pipeline legt automatisch zwei
   Kind-Buchungen mit `parent_buchung_id` an.

Außerdem bekommt das LLM zur Klassifizierung jetzt **Historie-Kontext**: wie
oft ein normalisierter Empfänger schon vorkam, in welcher Betragsspanne, in
welcher Kategorie. Damit erkennt der Agent Abos und wiederkehrende Muster
direkt beim Erst-Lauf.

## User Stories
- Als Inhaber möchte ich, dass „STRIPE\*ACME LTD" und „Acme Ltd. (Berlin)"
  als derselbe Empfänger erkannt werden, damit meine Lernregeln greifen und
  Auswertungen sauber sind.
- Als Inhaber möchte ich, dass der Agent bei unbekannten Empfängern selbst
  recherchiert, was die Firma macht, und diese Information für mich
  einsehbar speichert.
- Als Inhaber möchte ich pro Empfänger das gespeicherte Wissen (Branche,
  Leistung, Default-Kategorie) einsehen, korrigieren oder löschen können.
- Als Inhaber möchte ich Regelbedingungen per Regex formulieren können, um
  ganze Provider-Familien mit einer Regel abzudecken.
- Als Inhaber möchte ich Regeln definieren, die eine Buchung automatisch
  60/40 oder 70/30 splitten, damit Mischausgaben (Handy, Internet, Kfz) ohne
  Nacharbeit korrekt verbucht werden.
- Als Inhaber möchte ich die Klassifizierung für einzelne Buchungen mit dem
  neuen Wissen erneut anstoßen können (Re-Klassifizierung mit Cache).

## Acceptance Criteria

### P0 — Fundament (Normalisierung + Cache + Historie + Pipeline)
- [ ] Neue Spalte `buchung.empfaenger_normalisiert` (text, nullable, indexiert).
- [ ] Funktion `normalisiereEmpfaenger(raw): string` strippt Payment-Präfixe
  (`STRIPE*`, `PADDLE.NET*`, `PAYPAL *`, `SQ *`, `PP*`, `IZ*`), Rechtsformen
  (GmbH, UG, AG, KG, OHG, e.K., Inc., Ltd., LLC), Sonderzeichen, mehrfaches
  Whitespace; gibt lowercase zurück. ≥ 20 Snapshot-Tests gegen reale Empfänger.
- [ ] Konto-Import schreibt `empfaenger_normalisiert` ab sofort mit.
- [ ] Backfill-Skript `scripts/backfill-empfaenger-normalisiert.ts` läuft
  idempotent über alle bestehenden Buchungen, in Batches von 500.
- [ ] Neue Tabelle `empfaenger_kenntnis` mit RLS-Policy (owner-scoped),
  Composite-PK `(owner_id, empfaenger_norm)`, TTL-Feld, `quelle` ∈
  `{web, manuell, llm}`, `recherche_versucht` (Cooldown gegen Endlos-Retries).
- [ ] `holeKenntnis` / `upsertKenntnis` / `istAbgelaufen` als reine
  Service-Funktionen mit Unit-Tests.
- [ ] Pipeline-Reihenfolge: Normalisierung → Regeln → Cache-Lookup
  (Miss → proaktive Web-Recherche → Upsert) → Historie → LLM mit Kontext →
  Konfidenz-Routing → ggf. Split.
- [ ] Web-Recherche ist nicht mehr Fallback-Retry, sondern Füll-Mechanismus
  des Caches.
- [ ] LLM-Prompt bekommt `empfaenger_kenntnis` und `historie` (Anzahl,
  Betragsspanne, häufigste Kategorie, häufigste Klassifikation) als Kontext.
- [ ] DSGVO-Schutz: Web-Recherche und Cache nur für Empfänger mit
  Rechtsform-Indikator (GmbH/Ltd/etc.) oder ≥ 3 Wortteilen. Keine
  Privatpersonen-Namen im Cache.
- [ ] Bei `Konfidenz ≥ 0.85` schreibt die Pipeline die Klassifikation in
  `letzte_klassifikation_default` zurück (lernt aus erfolgreichen LLM-Calls).

### P0 — Kenntnis-UI
- [ ] Admin-Seite `/empfaenger-kenntnis` (Liste, Filter, Pagination).
- [ ] Edit-Dialog: Branche, Leistung, Default-Kategorie/Klassifikation
  überschreiben (`quelle = manuell`, TTL effektiv unbegrenzt).
- [ ] Delete-Aktion löscht Cache-Eintrag (Re-Recherche beim nächsten Treffer).
- [ ] Quick-Action im Buchungs-Detail-Sheet: „Empfänger-Wissen anzeigen" /
  „Cache-Eintrag löschen".
- [ ] Manuelle Korrektur in der Prüfliste invalidiert/upsertet den
  zugehörigen Cache-Eintrag automatisch (`quelle = manuell`).

### P1 — Regex-Bedingungen
- [ ] `lernregel.bedingung` darf zusätzlich zu `empfaenger_muster` und
  `zweck_muster` auch `empfaenger_regex` und `zweck_regex` enthalten.
- [ ] ReDoS-Schutz: Statischer Linter lehnt verschachtelte Quantoren
  (`(a+)+`, `(.*)*`), Alternation hinter Quantor und Backreferences mit
  Quantor ab. Maximal 200 Zeichen. DB-CHECK-Constraint als Defense-in-Depth.
- [ ] Regel-Engine wertet Regex case-insensitive gegen
  `empfaenger_normalisiert` (Fallback: rohes Feld) und `verwendungszweck` aus.
- [ ] Regel-Dialog UI: Regex-Felder mit Live-Validierung + Vorschau-Feld
  („passt auf diesen Beispiel-Empfänger?").
- [ ] `bedingungenGleich` und `findeRegelKonflikte` berücksichtigen die
  neuen Regex-Felder.

### P1 — Split-Aktionen
- [ ] `lernregel.aktion.split` mit Schema
  `{ anteil_geschaeftlich, anteil_privat, kategorie_geschaeftlich,
     kategorie_privat, ust_satz_geschaeftlich? }` — Anteile müssen sich
  zu 1 summieren.
- [ ] Split-Aktion schließt einfache `kategorie_id`/`klassifikation` aus.
- [ ] Pipeline wendet Split bei Regel-Treffer an: legt zwei Kind-Buchungen
  mit `parent_buchung_id` an, Eltern wird zur „Klammer" (analog Logik aus
  `pruefliste/entscheiden`).
- [ ] Helper `wendeSplitAn` aus bestehender Prüflisten-Route in
  `lib/classifier/split-apply.ts` extrahiert, von beiden Routen genutzt.
- [ ] UI: Split-Block im Regel-Dialog mit zwei Kategorie-Pickern, Slider
  0–100 %, Live-Vorschau (z. B. „60 % geschäftlich = 36,00 €, 40 % privat =
  24,00 €" bei 60-€-Beispielbuchung).

### P2 — Komfort
- [ ] Re-Klassifizierungs-Button auf Buchungs-Liste und Prüfliste:
  Multi-Select → POST `/api/klassifizierung` mit `buchung_ids` (manuell
  bestätigte werden weiterhin übersprungen).
- [ ] Konfigurierbarer Recherche-Schwellwert in `app_einstellung`
  (z. B. `web_recherche_betrag_min`, `web_recherche_nur_geschaeftlich`).
- [ ] Admin-Übersicht „Häufige Prüflisten-Empfänger" als
  Kandidatenliste für neue Lernregeln.

## Edge Cases
- **Race Condition** bei Massen-Lauf über 500 Buchungen mit gleichem
  unbekanntem Empfänger → In-Memory-Promise-Sharing pro Job, damit nur ein
  Web-Call pro Empfänger pro Lauf.
- **Falsches Erst-Caching** (LLM lag beim 1. Treffer daneben) → kürzere TTL
  (30 Tage) bei `quelle=llm`, manuelle Korrektur in Prüfliste upserted Cache
  mit `quelle=manuell`.
- **Privatperson als Empfänger** (Miete, Spende) → Recherche/Cache
  übersprungen, kein Web-Lookup.
- **Regex matcht zu breit** (z. B. `.*`) → Validation lehnt es ab; UI bietet
  Live-Probe gegen Beispiel-Empfänger.
- **Historie-Selbstreferenz** → Filter `status IN ('auto_verbucht',
  'manuell_bestaetigt')` und `id != currentBuchungId`.
- **Split mit USt-Mischsatz** → optional separate `ust_satz_geschaeftlich` in
  der Split-Aktion (privater Anteil bekommt 0 % bzw. Default).

## Technical Requirements
- **Performance**: Eine SQL-Query pro Historie-Lookup (mit `count` + `min` +
  `max` + Mode). Cache-Lookup als einzelner SELECT mit PK. Web-Calls
  pro Job dedupliziert.
- **Sicherheit**: RLS auf neuer Tabelle. Regex statisch geprüft + DB-CHECK.
  Kein OCR-Volltext / keine Steuernummern in den Web-Call. Empfängername
  ist das einzige Datum, das raus geht (DSGVO).
- **Auditierbarkeit**: Cache-Schreibvorgang erzeugt Audit-Eintrag
  (`aktion: 'kenntnis_aktualisiert'`, `quelle`). Split-Anwendung schreibt
  Audit für Eltern + jede Kind-Buchung.

---

## Tech Design

### Backend-Bedarf: Ja
Drei Migrationen, eine neue API + UI, vier neue Module in der Pipeline,
Erweiterungen an LLM-Prompt und Regel-Engine.

### Datenmodell

**Migration `0003_empfaenger_normalisiert.sql`**
- Spalte `buchung.empfaenger_normalisiert text`.
- Partial Index `idx_buchung_empf_norm ON buchung(owner_id, empfaenger_normalisiert) WHERE empfaenger_normalisiert IS NOT NULL`.

**Migration `0004_empfaenger_kenntnis.sql`**
```sql
CREATE TABLE empfaenger_kenntnis (
  owner_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empfaenger_norm    text NOT NULL,
  rohwert_beispiel   text,
  branche            text,
  leistung           text,
  web_snippets       jsonb,
  letzte_klassifikation_default jsonb,
  quelle             text NOT NULL CHECK (quelle IN ('web','manuell','llm')),
  recherche_versucht boolean NOT NULL DEFAULT false,
  cached_at          timestamptz NOT NULL DEFAULT now(),
  ttl_tage           integer NOT NULL DEFAULT 180,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, empfaenger_norm)
);
-- RLS + Trigger set_updated_at + Index auf cached_at
```

**Migration `0005_lernregel_regex_split.sql`**
- CHECK-Constraint für Regex-Längen-Limit (≤ 200 Zeichen) auf
  `bedingung->>'empfaenger_regex'` und `bedingung->>'zweck_regex'`.
- Schema-Erweiterung ist konventionell (JSONB), kein DDL nötig.

### Komponentenstruktur

```
Pipeline (lib/classifier/)
├── normalize.ts            [NEU] reine Funktion + Tests
├── empfaenger-cache.ts     [NEU] hole/upsert/istAbgelaufen
├── historie.ts             [NEU] holeAehnlicheBuchungen
├── regex-engine.ts         [NEU] kompiliereWennSicher (mit Linter)
├── split-apply.ts          [NEU] Extraktion aus pruefliste-Route
├── rules.ts                [ÄND] Regex-Matching + empfaenger_normalisiert
├── pipeline.ts             [ÄND] Neue Reihenfolge + Cache-Wiring
├── llm.ts                  [ÄND] Prompt mit Kenntnis + Historie
└── web-research.ts         [ÄND] aus Cache aufgerufen statt Pipeline-Retry

API
├── /api/empfaenger-kenntnis           [NEU] GET (Liste)
├── /api/empfaenger-kenntnis/[empf]    [NEU] PATCH / DELETE
├── /api/regeln                        [ÄND] Regex + Split validieren
└── /api/klassifizierung               [ÄND] Buchung mit empfaenger_normalisiert

UI
├── /empfaenger-kenntnis (Admin)       [NEU] Liste + Edit + Delete
├── components/empfaenger-kenntnis/    [NEU] Tabelle + Edit-Dialog
├── components/regeln/regel-dialog.tsx [ÄND] Regex-Felder + Split-Block
└── components/.../buchung-detail.tsx  [ÄND] Quick-Action „Wissen anzeigen"
```

### LLM-Prompt-Erweiterung
Zusätzliche Blöcke im System/User-Prompt:
- **Empfänger-Kenntnis**: „Diese Firma macht <leistung> (Branche: <branche>).
  Quellen: <3 Snippet-Titel>"
- **Historie**: „Dieser Empfänger taucht bereits N× auf, Betrag zwischen
  X € und Y €, meistens als <kategorie_bezeichnung> verbucht."

### Abhängigkeiten (Pakete)
Keine neuen Hard-Dependencies. **Firecrawl ist bereits drin**
(`@mendable/firecrawl-js@4.24.2`). `re2` wurde bewusst verworfen — wir
nutzen statischen Linter, um Vercel-Runtime-Kompatibilität zu garantieren.

## Implementierungsnotizen

### 2026-05-20 — P0-1/P0-2/P0-3 (Normalisierung-Fundament)
- Migration `supabase/migrations/0003_empfaenger_normalisiert.sql` legt die
  Spalte `buchung.empfaenger_normalisiert` (nullable) plus partiellen Index
  `idx_buchung_empf_norm (owner_id, empfaenger_normalisiert) WHERE
  empfaenger_normalisiert IS NOT NULL` an. RLS-Policy aus 0001 deckt die
  neue Spalte automatisch ab.
- `src/lib/classifier/normalize.ts` implementiert `normalisiereEmpfaenger`
  als reine, idempotente Funktion. Pipeline:
  Payment-Praefixe (PADDLE.NET/PADDLE/STRIPE/PAYPAL/SP/SQ/PP/IZ) →
  End-Klammern → Rand-Sonderzeichen → Rechtsformen
  (GmbH/UG/AG/KG/OHG/GbR/e.K./e.V./Inc./Ltd./LLC/LLP/B.V./S.A./S.L./Co./Corp.,
  inkl. „UG (haftungsbeschränkt)" und „GmbH & Co. KG") → erneut Klammern →
  Whitespace-Kollaps → `toLocaleLowerCase("de-DE")` (Umlaut-stabil).
- Bewusste Auslegung: „DE", „EU" und andere Laender-/Sprachkuerzel werden
  NICHT als Rechtsform behandelt — „ACME LTD DE" wird zu „acme de"
  (Test deckt das explizit ab). Begruendung: zu hohe Verwechslungsgefahr
  mit echten Wortbestandteilen (z. B. „PRO DE" = Produkt-Suffix).
- Word-Boundary `(^|[\s,])` davor und `(?=\s|$|,)` danach verhindert, dass
  Rechtsformen aus echten Woertern gefressen werden („Agentur" bleibt
  unveraendert, obwohl „AG" enthalten ist).
- `src/lib/classifier/normalize.test.ts` mit 52 Tests (Payment-Praefixe,
  Rechtsformen, Klammern, Umlaute, Kombinationen, Edge-Cases inkl. null/
  undefined/leerer String/nur Sonderzeichen, sehr lange Strings,
  Idempotenz-Property fuer 10 deterministisch zufaellige Inputs).
- `scripts/backfill-empfaenger-normalisiert.ts` ist standalone tsx-Skript
  mit `--dry-run`-Flag. Liest `.env.local` ohne dotenv-Dependency, nutzt
  `SUPABASE_SERVICE_ROLE_KEY` (RLS-Bypass, single-tenant). Verarbeitet
  Batches von 500, Updates mit Parallelitaet 5. Loggt Fortschritt pro
  Batch sowie Top-10-Normalisierungen am Ende fuer Plausibilitaetspruefung.
  Idempotent: filtert `empfaenger_normalisiert IS NULL`.
- Import-Routen schreiben die neue Spalte ab sofort mit:
  - `src/app/api/konten/import/route.ts` (Excel/CSV/manuelle Erfassung
    laufen alle ueber diesen Pfad nach dem Parser).
  - `src/app/api/pruefliste/entscheiden/route.ts` (Split-Kinder erben den
    normalisierten Schluessel von der Klammerbuchung).
- Tests: 391 passed (vorher 339 — die 52 neuen Tests sind alle gruen, kein
  Bestandsfall durch die nullable Spalte beschaedigt).
- Lint: 0 Errors, 2 unveraenderte Warnings (`ki-panel.tsx` React-Compiler-
  Hinweis und `use-toast.ts` ungenutzte Konstante — beides Bestand).
- Build: ✓ erfolgreich.

### 2026-05-20 — P0-5/P0-6/P0-7/P0-8 — Cache + Historie + Pipeline-Umbau

- Migration `supabase/migrations/0004_empfaenger_kenntnis.sql` legt die
  Cache-Tabelle `empfaenger_kenntnis` mit Composite-PK
  `(owner_id, empfaenger_norm)`, Quelle-Check
  `(web|manuell|llm)`, `recherche_versucht`-Cooldown, `cached_at`/`ttl_tage`
  und `set_updated_at`-Trigger an. RLS owner-scoped (`owner_id = auth.uid()`),
  Sekundaerindex `idx_empfaenger_kenntnis_cached_at` fuer Admin-Listen.
- `src/lib/classifier/empfaenger-cache.ts` implementiert die Cache-API:
  - `holeKenntnis` / `upsertKenntnis` / `istAbgelaufen` / `istRechercheKandidat`
    / `defaultTtl` / `neueInflightMap`.
  - TTL-Defaults: manuell ≈ 100 Jahre (faktisch unbegrenzt), web 180 Tage,
    llm 30 Tage (kuerzer, weil LLM-Klassifikation auch falsch sein kann).
  - DSGVO-Gate `istRechercheKandidat(roh, normalisiert)` schickt nur dann
    in die Recherche, wenn der Rohwert einen Rechtsform-Indikator enthaelt
    (GmbH/UG/AG/KG/OHG/GbR/eK/eV/Inc/Ltd/LLC/LLP/BV/SA/SL/Co/Corp/SE/SpA/
    Srl/Oy/Ab) ODER der normalisierte Wert ≥ 3 Wortteile hat.
  - Best-effort-Audit: nach erfolgreichem Upsert wird ein zusaetzlicher
    `audit_eintrag`-Insert mit `aktion='kenntnis_aktualisiert'` und
    `entitaet='empfaenger_kenntnis'` geschrieben. Schlaegt der Audit-Insert
    fehl, propagiert das KEINEN Fehler (Cache ist die fachlich wichtige
    Operation).
- `src/lib/classifier/historie.ts` implementiert
  `holeAehnlicheBuchungen(owner_id, empfaenger_norm, opts)` als einzige
  Supabase-Query (`SELECT betrag, kategorie_id, klassifikation` mit
  Owner/Norm/Status-Filter, optionaler `ausschluss_id` fuer Self-Ref,
  Limit 50). Aggregation in JS via `aggregiere()` (Min/Max/Median, Mode
  fuer Kategorie und Klassifikation). Reine Funktion + DB-Wrapper
  getrennt fuer Testbarkeit.
- `src/lib/classifier/pipeline.ts` umgebaut auf die neue Reihenfolge:
  1. Regel-Engine (Vorrang, unveraendert).
  2. Cache-Lookup ueber `empfaenger_normalisiert` — Hit & nicht abgelaufen
     liefert den LLM-Kontext direkt; Miss + DSGVO-Kandidat +
     `web_recherche_aktiv` triggert genau einen Firecrawl-Call (mit
     InflightMap-Race-Schutz) und schreibt das Ergebnis in den Cache.
  3. Historie-Lookup fuer denselben normalisierten Empfaenger.
  4. EIN LLM-Call mit `empfaenger_kenntnis` + `historie` + optionalem
     `web_kontext` — KEIN Retry-Loop mehr; die Web-Recherche ist
     Fuell-Mechanismus des Caches, kein Pipeline-Fallback.
  5. Konfidenz-Routing wie bisher (Schwellwert, Ausreisser, Default-
     Kategorien).
  6. Nach erfolgreichem LLM-Call mit Konfidenz ≥ Schwellwert: Upsert
     mit `quelle='llm'` und kuerzerer TTL, AUSSER es liegt schon eine
     manuelle Kenntnis vor (die wird NIE vom LLM-Upsert ueberschrieben).
- Bewusste Entscheidung: `webGenutzt`/`webQuery` werden in der Pipeline
  ueber das separate Flag `frischRecherchiert` getrackt, NICHT aus
  `cacheVorhanden` abgeleitet — der frisch-upsertete Cache-Eintrag ist
  ja per Definition nicht abgelaufen, sodass `cacheVorhanden` nach der
  Recherche immer true ist. Genau diese Race war initial im Code und
  hat den Test "Cache-Miss + Recherche-Kandidat → Firecrawl-Call" auf
  `audit.details.web_recherche = undefined` brechen lassen.
- `src/lib/classifier/llm.ts` bekommt zwei neue, optionale Felder im
  `LlmEingabe`-Interface (`empfaenger_kenntnis`, `historie`) und zwei
  reine Helper `baueKenntnisBlock` / `baueHistorieBlock`, die nur dann
  Text emittieren, wenn der jeweilige Kontext sinnvoll ist
  (Kenntnis: vorhanden; Historie: anzahl ≥ 2). Datensparsamkeit
  unveraendert: an das LLM gehen weiterhin nur Verwendungszweck/Betrag/
  Empfaenger + optionaler Kontext, KEIN OCR-Volltext oder Steuernummern.
- `src/app/api/klassifizierung/route.ts` zieht das `empfaenger_normalisiert`
  jetzt mit aus `buchung`, legt EINE `InflightMap` pro Job an und uebergibt
  `{ supabase, ownerId, inflight }` als `PipelineKontext` an
  `klassifiziereBuchung`. Die Map ist BEWUSST job-scoped (nicht modul-global)
  — siehe "Offene Entscheidungen" oben: Tests muessen nichts mocken,
  parallele Jobs blockieren sich nicht und es gibt keinen Memory-Leak
  ueber die Lebenszeit des Server-Prozesses.
- `src/lib/classifier/pipeline.test.ts`: Buchungs-Factory liefert jetzt
  `empfaenger_normalisiert` immer mit (Default `""`), damit der reale
  Pipeline-Pfad nach dem Import abgebildet wird. Tests, die Cache oder
  Recherche bewusst triggern, setzen den Wert explizit. Zusaetzlich
  ein kompletter neuer `describe`-Block "PROJ-15 Cache-First" mit
  Supabase-Mock-Helper `makePipelineSupabase` (Cache als in-memory Map,
  Audit-Insert als Spy, Historie-Result konfigurierbar). 7 neue Tests:
  Cache-Miss + Recherche + Upsert + Audit, Cache-Hit, DSGVO-Gate
  Privatperson, InflightMap-Dedup unter Promise.all, Web-Recherche
  abgeschaltet, LLM-Upsert mit `letzte_klassifikation_default`,
  manuelle Kenntnis wird nicht vom LLM-Upsert ueberschrieben. Ausserdem
  ein angepasster Bestandstest "ohne PipelineKontext → kein Cache, kein
  Recherche, EIN LLM-Aufruf", der die alte Retry-Logik ersetzt
  (Web-Recherche ist nicht mehr Pipeline-Retry).
- `src/lib/classifier/empfaenger-cache.test.ts` mit 18 Tests (`istAbgelaufen`
  inkl. Grenzfaellen ttl=0 / genau am Ablauftag, `istRechercheKandidat`
  inkl. "Agentur" vs. "AG" Wortgrenzen-Schutz, `defaultTtl`,
  `holeKenntnis`/`upsertKenntnis` mit Supabase-Mock, `neueInflightMap`).
- `src/lib/classifier/historie.test.ts` mit 9 Tests (`aggregiere` inkl.
  Median ungerade/gerade, Mode-Zaehlung, Eintraege ohne kat/klass;
  `holeAehnlicheBuchungen` mit Mock fuer leere/fehlerhafte/erfolgreiche
  DB-Aufrufe und Self-Ref-Ausschluss).
- Tests: 434 passed (vorher 391 — 43 neue Tests fuer Cache + Historie +
  Pipeline-Cache-First, alle gruen).
- Lint: 0 Errors, 2 unveraenderte Warnings (`ki-panel.tsx` und
  `use-toast.ts` — beides Bestand, nicht PROJ-15).
- Build: ✓ erfolgreich. Ein TypeScript-Cast in `holeKenntnis` musste auf
  `as unknown as EmpfaengerKenntnis` ausgeweitet werden, weil der
  Supabase-Client den Select-String nicht statisch in den Zieltyp
  aufloesen kann (Returnform `GenericStringError | T`).

### 2026-05-20 — normalize.ts-Verfeinerung nach Backfill-Dry-Run

Hintergrund: Der erste Backfill gegen 425 reale Buchungen zeigte in der
Top-10-Verteilung mehrere unsaubere Normalisierungen — vor allem PayPal
mit voller Luxemburger Anschrift, alle Amazon-Tochterentities und
Adress-/PLZ-Reste am Ende der Strings.

Geaendert: `src/lib/classifier/normalize.ts` + `normalize.test.ts`.

- **Neue Rechtsformen** (Reihenfolge: laengere Varianten zuerst):
  - Aktiengesellschaft (ausgeschriebenes AG-Synonym, taucht in
    Skandia/enercity-Eintraegen auf).
  - FR/LU-Formen: `S.a.r.l. et Cie`, `S.A.R.L. et Cie`,
    `S.a r.l. et Cie` (PayPal-Variante ohne Punkt zwischen `a` und
    `r`), `S.A.R.L`, `S.a.r.l`, `S.a r.l`, `SARL`, `Sarl`, `et Cie`.
  - `S.C.A`, `SCA`, `S.A.S`, `SAS` (PayPal/Amazon).
  - `AB` (Klarna, schwedische Aktiengesellschaft).
  - Der bestehende Regex `(^|[\\s,])${literal}\\.?(?=\\s|$|,)` kommt
    mit Multi-Punkt-Tokens wie `S.C.A.` klar, weil `regexEscape` die
    Punkte literal macht und `\\.?` am Ende den optionalen Trailing-
    Punkt erlaubt. Verifiziert per Probe-Run.
- **`entferneAdresseAmEnde()`** — neue Funktion, iterativ (max. 5):
  1. Komma-getrennte End-Adresse (`, 22-24 Boulevard Royal, 2449 Luxembourg`).
  2. PLZ + Ort am Ende.
  3. Hausnummer (auch `22-24` mit Bindestrich, `12a` mit Buchstabe) +
     adress-typisches Folgewort (Strasse/Boulevard/...) + weitere Tokens.
  4. Strassenname-Token am Ende (DE-Suffix-Liste: strasse, straße,
     str., str, weg, platz, allee, gasse, ring, damm, boulevard).
  5. Hausnummer am Ende ohne Strassennachbarwort.
- **`entferneLaendercodeSuffix()`** — entfernt `DE`/`EU`/`INT`/
  `INTERNATIONAL` am Ende, NUR wenn davor noch mindestens ein Wort
  steht. Damit faellt `acme de` → `acme`, ein einzelnes `de` bleibt.
  **Bewusster Bruch der alten Auslegung** (Notiz vom 2026-05-20 oben,
  „DE bleibt erhalten") — Backfill hat gezeigt, dass `Amazon Payments
  Europe S.C.A. DE` und `Amazon Payments Europe S.C.A.` dieselbe Firma
  sind und denselben Schluessel ergeben muessen. Bestehender Test
  `"ACME LTD DE" → "acme de"` umgeschrieben zu `→ "acme"`, plus neuer
  Test fuer einzelnes `DE`/`EU` als ganzen Empfaenger (bleibt erhalten).
- **`verdichteKonzern()`** — Markennamen-Verdichtung. Liste:
  `american express`, `amazon`, `google`, `apple`, `microsoft`,
  `paypal`, `skandia`, `strato`, `klarna`, `enercity`. Wenn der
  normalisierte String mit einem Marker + Whitespace beginnt (Wortgrenze
  schuetzt „amazonas reisen"), wird er auf den Marker reduziert.
  Aggressive Verdichtung war die User-Entscheidung — alle Amazon-Tochter-
  entities werden auf `amazon` zusammengezogen.
- **`reduziereSlashDuplikat()`** — `enercity / enercity Aktiengesellschaft`
  → bei identischem Wort vor und nach dem Slash wird das Wort einmal
  behalten. Schliesst die Luecke fuer Self-Referenz-Eintraege.
- **PayPal-Sonderfall (Markennamen-Fallback)** — `entferneEinenPayment
  Praefix` liefert jetzt zusaetzlich den gestrippten Praefix-Token
  zurueck. Wir merken uns den ERSTEN gestrippten Praefix und mappen ihn
  ueber `PAYMENT_PRAEFIX_MARKENNAME` auf einen Marken-Schluessel
  (`PADDLE.NET`/`PADDLE` → `paddle`, `STRIPE` → `stripe`, `PAYPAL` →
  `paypal`; `SP`/`SQ`/`PP`/`IZ` → `null`, weil reine Acquirer-Codes
  ohne stehende Marke). Wenn am Ende der Pipeline der Rest leer ist
  oder rein generisch (`europe`, `international`, `germany`,
  `deutschland`, `eu`, `de`, `ireland`, `uk`, `usa`, oder eine Folge
  aus diesen Tokens + `payments`/`services`/`holdings`/`global`/
  `world`), wird der Marken-Name als Endwert gesetzt. So wird
  `PayPal Europe S.a.r.l. et Cie S.C.A 22-24 Boulevard Royal, 2449
  Luxembourg` zu `paypal`, ohne dass `PAYPAL *NETFLIX` → `netflix`
  bricht (dort ist `netflix` kein generischer Rest).
- **Reihenfolge in der Pipeline** (jetzt 13 Schritte): Praefixe →
  End-Klammern → Rand-Bereinigung → Rechtsformen → End-Klammern →
  Adresse → Rechtsformen (zweiter Pass, weil Adress-Entfernung neue
  End-Tokens freilegen kann) → Rand-Bereinigung → Slash-Duplikat →
  lowercase → Laendercode-Suffix → Konzern-Verdichtung → Marken-
  Fallback. Idempotenz haendisch fuer alle realen Cases + via
  Mulberry32-Property-Test (10 Pseudo-Random-Inputs) geprueft.

Neue Tests in `normalize.test.ts`:
- Neuer `describe`-Block „Reale Daten aus dem Backfill (2026-05-20)"
  mit 13 `it.each`-Cases (1:1 die Top-10 + Klarna/American Express/
  enercity) + 1 Idempotenz-Test ueber dieselbe Liste.
- Bestehender Test fuer DE-Erhalt umgeschrieben + neuer Test fuer
  einzelnes `DE`/`EU` als Empfaenger.

Tests: 449 passed (vorher 434 — +15 neue, alle bestehenden Snapshot-Tests
unveraendert gruen, inkl. `STRIPE*ACME LTD → acme` und
`Mueller-Luedenscheidt GmbH → mueller-luedenscheidt`).

Lint: 0 Errors, 2 unveraenderte Warnings (`ki-panel.tsx`, `use-toast.ts`
— beides Bestand).

Build: ✓ erfolgreich, kein zusaetzlicher Compile-Aufwand.

Offen / bewusste Annahmen:
- **Stripe/PayPal als ECHTE Firma vs. Durchlauf** — ein eigenstaendiges
  `Stripe` ohne `*`-Trenner (z. B. `Stripe Payments UK`) wird heute durch
  den Praefix-Stripper geschluckt und ueber den Marken-Fallback wieder
  hergestellt, weil `payments uk` generisch ist. Wenn ein Test-Datensatz
  auftaucht, in dem nach Stripe noch ECHTE Inhalte stehen (`Stripe
  Acme Acquisitions`), wuerde das zu `acme acquisitions` werden, nicht
  zu `stripe acme acquisitions`. Wenn das ein Problem wird, muessen wir
  den Praefix-Strip nur fuer `*`-Trenner aktivieren oder den Marken-Name
  immer voranstellen. Bisher kein realer Case dafuer beobachtet.
- **Skandia/Strato/Klarna/enercity** sind hartcodiert in der Konzern-
  Marker-Liste. Wenn die Liste waechst, sollte das aus einem
  Konfigurationspunkt kommen (z. B. `empfaenger_kenntnis` mit
  `markenname` als kanonischer Cache-Schluessel). Fuer den aktuellen
  Backfill ist die statische Liste pragmatisch und ausreichend.
- **Strassennamen-Suffix-Liste** ist DE-zentriert. Schwedische
  (`vagen`/`vägen`), franzoesische (`rue`, `avenue`) und englische
  (`street`, `road`) sind nicht explizit drin — sie werden nur indirekt
  ueber Hausnummer-Pattern + Konzern-Marker gefangen. `Klarna Bank AB
  Sveavagen 46` funktioniert NUR weil `Klarna` Konzern-Marker ist;
  ohne den Marker waere `bank sveavagen` uebrig. Erweiterung der
  Strassen-Suffix-Liste wird empfohlen, sobald skandinavische/
  franzoesische Adressen haeufiger auftauchen.

### 2026-05-20 — Bug-Fix: Branche/Leistung-Extraktion + Cache-Quelle bewahren

Hintergrund: Nach dem ersten Re-Klassifizierungs-Lauf gegen reale Daten
hatten 76/84 Cache-Eintraege zwar `web_snippets`, aber ALLE 84 hatten
`branche=NULL` und `leistung=NULL`. Ausserdem ueberschrieb der hochkonfidente
LLM-Konfidenz-Upsert in der Pipeline einen bestehenden `quelle='web'`-
Eintrag mit `quelle='llm'` — und nullte dabei Branche/Leistung/Snippets,
auch wenn das LLM nur die Klassifikation aktualisieren sollte.

**Bug 1: Branche/Leistung wurden nie extrahiert**
- `src/lib/classifier/web-research.ts`: neue Funktion
  `extrahiereBrancheUndLeistung(snippets, empfaengername, opts?)` macht
  einen kleinen LLM-Call ueber `generateObject` + Zod-Schema mit den drei
  Snippets. Schema beider Felder ist `string.nullable()`: das LLM soll
  explizit `null` zurueckgeben, wenn aus den Snippets nichts Eindeutiges
  ablesbar ist (statt zu raten oder leere Strings zu liefern).
- Provider-Wahl spiegelt das Pattern aus `lib/classifier/llm.ts`:
  `sk-ant-…` → direkter Anthropic-Provider mit Modell-Slug-Normalisierung
  (`anthropic/claude-haiku-4.5` → `claude-haiku-4-5`), sonst Vercel AI
  Gateway. Modell-Default aus `process.env.STEUERAGENT_LLM_MODEL` via
  `ladeAiKey()` (gleiche Quelle wie der Haupt-Klassifizierer).
- Timeout 5s ueber Promise-Race. Bei jedem Fehler (kein Key, Timeout,
  Schema-Bruch, LLM-Exception) → `null`. Wirft NIE — Cache-Pflege darf
  den Klassifikations-Pfad nicht abbrechen.
- `recherchiereUndUpserte` in `pipeline.ts` ruft die Extraktion nach
  Firecrawl-Erfolg auf und schreibt Branche/Leistung mit in den Cache-
  Upsert. Bei leeren Snippets / null wird der Aufruf uebersprungen.
- Mockbarkeit: neuer `ExtrahiereFn`-Typ in `pipeline.ts`, als 8. Parameter
  von `klassifiziereBuchung` mit Default-Implementierung. Tests koennen
  ihn ueber denselben Mechanismus mocken wie `rechercheFn`.

**Bug 2: LLM-Konfidenz-Upsert ueberschrieb `quelle='web'` mit `quelle='llm'`**
- `src/lib/classifier/empfaenger-cache.ts`: neue Funktion
  `aktualisiereLetzteKlassifikation(supabase, owner_id, empfaenger_norm,
  letzte_klassifikation_default)` setzt per UPDATE ausschliesslich
  `letzte_klassifikation_default`, ohne `quelle`, `branche`, `leistung`
  oder `web_snippets` anzufassen. Best-effort (kein Throw bei DB-Fehler).
- `pipeline.ts`: Der LLM-Konfidenz-Upsert verzweigt nach Kenntnis-Quelle:
  - `kenntnis === null` → `upsertKenntnis` mit `quelle='llm'`, alle Felder
    null (kein Web-Wissen vorhanden).
  - `kenntnis.quelle === 'web'` → `aktualisiereLetzteKlassifikation`
    (nur das eine Feld). Branche/Leistung/Snippets/Quelle bleiben.
  - `kenntnis.quelle === 'llm'` → `upsertKenntnis` mit `quelle='llm'`,
    bestehende Branche/Leistung/Snippets werden erhalten.
  - `kenntnis.quelle === 'manuell'` → bewusst KEINE Aktion (wie bisher).

**Tests (3 Module)**
- `web-research.test.ts` (NEU, 8 Tests): happy path, Trim/null-
  Normalisierung, LLM liefert null/null, leeres Snippets-Array, LLM-
  Exception, kein AI-Key, `ladeAiKey` wirft, Timeout greift, Gateway-
  Provider-Pfad. AI-SDK + `ladeAiKey` werden via `vi.mock` gestubbt.
- `empfaenger-cache.test.ts` (+3 Tests): Skip-Bedingung leerer Norm,
  korrekter UPDATE-Aufruf mit Filtern, Best-effort bei DB-Fehler.
- `pipeline.test.ts` (3 neue + 1 erweiterter Test): Web-Recherche schreibt
  Branche/Leistung mit (statt nur Snippets); Inflight-Map dedupliziert
  auch die Extraktion; (a) Cache leer ohne Recherche → Upsert mit
  `quelle='llm'`, alle Felder neu; (b) Cache 'web' vorhanden → quelle
  bleibt 'web', nur `letzte_klassifikation_default` per UPDATE; (c) Web-
  Recherche schlaegt fehl (kein Snippets) → kein 'llm'-Upsert, sondern
  UPDATE auf bestehenden Web-Cooldown-Eintrag. Pipeline-Mock-Supabase um
  `update`-Branch erweitert (in-memory Patch + UpdateSpy).

**Ergebnis**
- Tests: 463 passed (vorher 449 — +14 neu, alle bestehenden gruen).
- Lint: 0 Errors, 2 unveraenderte Warnings (ki-panel.tsx, use-toast.ts).
- Build: erfolgreich.

**Offene Annahmen / Trade-offs**
- Wenn Firecrawl Snippets liefert, aber der Extraktor anschliessend
  hängt/scheitert, schreiben wir den Cache-Eintrag trotzdem (mit
  `branche=null`, `leistung=null`). Beim naechsten Treffer wird der
  Empfaenger wegen `recherche_versucht=true` nicht erneut recherchiert
  — Branche/Leistung bleiben dann leer, bis der Cache abgelaufen ist
  oder manuell invalidiert wird. Bewusste Entscheidung: Firecrawl-
  Budget > Extraktions-Retry.
- Der `extrahiereBrancheUndLeistung`-Aufruf verbraucht zusaetzliches LLM-
  Budget pro Erstkontakt mit einem Empfaenger. Bei 84 Cache-Eintraegen
  einmalig, danach amortisiert ueber alle Folge-Buchungen desselben
  Empfaengers — Erwartung: Net-positiv, weil der LLM-Haupt-Klassifizierer
  mit Branche/Leistung-Kontext seltener in die Pruefliste rutscht.

### 2026-05-20 — Retry-Mechanismus + Konsistenz-Pass (Phase 2)

Hintergrund: Im laufenden Betrieb fielen zwei wiederkehrende Schwaechen auf,
die der bisherige Cache-/Historie-Stack nicht abdeckt:
1. Das LLM liefert stochastisch immer wieder `NoObjectGeneratedError` —
   beim zweiten Versuch ist die Antwort meist sofort konform. Bisher landeten
   diese Buchungen sofort mit `pruef_grund='ki_nicht_verfuegbar'` in der
   Prueflisten-Warteschlange.
2. Bei haeufig vorkommenden Empfaengern (Accenture, Enercity, Rene Kilian)
   sehen wir 1-2 Ausreisser-Klassifikationen pro Empfaenger. Der Cache
   selber sortiert das nicht auf, weil der LLM-Konfidenz-Upsert die
   Default-Klassifikation immer fuer einzelne Buchungen entscheidet.

Loesung in zwei Schritten:

**(A) Retry-Mechanismus in `llm.ts`**
- Neue reine Funktion `istRetryFaehig(err)` unterscheidet zwischen
  retry-faehigen Fehlern (`NoObjectGeneratedError` aus dem AI-SDK,
  `APICallError` mit Status 5xx oder ohne Statuscode) und permanenten
  Fehlern (4xx — fehlender Key, falsches Modell, Schema-Fehler im
  Aufruf). `fehler.isRetryable === false` wird respektiert.
- `klassifiziereMitLlm` hat jetzt eine Schleife `for (versuch = 0;
  versuch <= MAX_RETRIES; versuch++)`. `MAX_RETRIES = 1` → insgesamt
  bis zu 2 Versuche pro Buchung. Wartezeit zwischen Versuchen:
  `RETRY_BASE_DELAY_MS = 800` + bis zu `RETRY_JITTER_MS = 200` Jitter.
- Test-Override `_setRetryDelayForTest(0)` druckt die Wartezeit in der
  Test-Suite auf 0, damit Retry-Tests deterministisch und schnell laufen.
  Bewusst NICHT oeffentlich exportiert (Helper-Konvention `_set…ForTest`).
- `LlmKlassifiziererError` traegt das neue Feld `retries` (Anzahl
  durchgefuehrter Retries). Erfolgreiche LLM-Antworten transportieren
  `retries` als zusaetzliches Feld im Rueckgabe-Objekt — Pipeline
  uebernimmt es ins Audit.
- `src/lib/classifier/llm.test.ts` (NEU, 11 Tests): Initial-Erfolg ohne
  Retry, Retry nach `NoObjectGeneratedError` mit anschliessendem Erfolg,
  Retry nach `APICallError` 503/Netzwerk, KEIN Retry bei 401/422,
  KEIN Retry bei `isRetryable=false`, beide Versuche fehlgeschlagen
  → `retries=1` im Error, Audit-Feld `llm_retries` korrekt gesetzt.

**(B) Konsistenz-Pass (Phase 2 des Jobs)**
- Neues Modul `src/lib/classifier/konsistenz-pass.ts`:
  - Reine Funktion `bestimmeMehrheit(buchungen)` mit den 4 Sicherheits-
    Kriterien: mind. 3 Buchungen je Empfaenger, mind. 2 distinct
    `kategorie_id`, Mehrheits-Anteil ≥ 60 %, Durchschnitts-Konfidenz
    der Mehrheits-Kategorie ≥ 0.85, einheitliche Klassifikation
    (privat/geschaeftlich/neutral darf NICHT gemischt sein — der
    PayPal-Mischfall mit 75% Privat + 25% Neutral-Geldtransit faellt
    genau hier raus und bleibt unangetastet).
  - End-to-end `wendeKonsistenzPassAn(supabase, owner_id)`:
    laed in EINEM Query alle Buchungen mit Status `auto_verbucht` oder
    `zur_pruefung` und nicht-null `empfaenger_normalisiert` (Limit
    10000), gruppiert in JS nach Empfaenger, ruft `bestimmeMehrheit`,
    schreibt nicht-konforme Buchungen pro Empfaenger in Batches von 50
    auf die Mehrheits-Kategorie um, mit `status='auto_verbucht'`,
    `pruef_grund=null`, `konfidenz=max(alt, 0.85)`, `quelle='ki'`.
  - Schutz-Invariante: `.neq("status", "manuell_bestaetigt")` in jedem
    Update — manuell bestaetigte Buchungen sind NIE Ziel des Passes,
    weder vom Query noch von der UPDATE-Bedingung.
  - Priorisierung: Buchungen mit `pruef_grund='ki_nicht_verfuegbar'`
    (LLM-Aussetzer aus (A)) werden zuerst angefasst — wenn die
    Mehrheits-Klassifikation klar ist, ist die zweite Chance des Passes
    fachlich der bessere Match als ein zweiter Retry.
  - Audit-Eintrag je angepasster Buchung: `aktion='konsistenz_pass'`,
    `quelle='ki'`, `entitaet='buchung'`. `details`-Felder:
    `empfaenger_norm`, `vorher_kategorie_id`, `nachher_kategorie_id`,
    `vorher_status`, `vorher_pruef_grund`, `mehrheit_anzahl`,
    `gesamt_anzahl`, `avg_konfidenz_mehrheit`.
  - Best-effort: Audit-Insert wird mit `.then(noop, noop)` abgesichert,
    damit Audit-Fehler den Pass nicht abbrechen.
- `src/lib/classifier/konsistenz-pass.test.ts` (NEU, 14 Tests):
  - 7 reine Funktions-Tests fuer `bestimmeMehrheit`: 3+1-Mehrheit,
    2+2-Patt, niedrige Konfidenz, Mischklassifikation,
    PayPal-Pattern (3 Privat + 1 Neutral → NICHT angepasst),
    konsistente Gruppe, nur `zur_pruefung`-Buchungen.
  - 7 End-to-end-Tests mit Mock-Supabase (`makeSupabase`): 3+1-Anpassung
    mit Audit-Capture, Patt → `empfaenger_uneinheitlich`, PayPal-Pattern,
    `manuell_bestaetigt` bleibt unberuehrt, Gruppe mit nur 2 Buchungen
    wird uebersprungen, Audit-Details enthalten alle Zaehlfelder,
    `pruef_grund='ki_nicht_verfuegbar'` wird mit Vorrang angepasst.
  - **Mock-Mutability-Fix**: Der Mock-Update mutiert `state.buchungen`
    direkt via `Object.assign(target, patch)`. Damit der Audit-Capture-
    Code in `wendeKonsistenzPassAn` die `vorher`-Werte unverfaelscht
    lesen kann, liefert der Mock-Read aus `limit()` eine flache
    Kopie der Buchungen (`.map((b) => ({ ...b }))`), damit Updates
    auf `state.buchungen` die Referenzen in `data` nicht beruehren.
    Reicht aus, weil die zu pruefenden Felder primitiv sind (keine
    verschachtelten Objekte/Arrays in `BuchungRow`).
- `src/app/api/klassifizierung/route.ts`: nach der Hauptschleife wird
  `wendeKonsistenzPassAn(supabase, user.id)` als Phase 2 desselben Jobs
  aufgerufen. Ergebnis landet im Response-Feld `konsistenz_pass`. Pass
  ist best-effort: Fehler wird mit `try/catch` geschluckt und
  `konsistenz_pass = null` gesetzt, damit Hauptphasen-Erfolge nicht
  als `status='fehler'` markiert werden.
- `src/components/buchungen/klassifizierung-panel.tsx`: neue Karte
  „Konsistenz-Pass (Phase 2)" mit 4 Badges (Geprueft, Angepasst,
  Buchungen, Uneinheitlich) — nur sichtbar, wenn `konsistenz_pass`
  im Ergebnis vorhanden ist.

**Ergebnis**
- Tests: 492 passed (vorher 463 — +29 neu: 14 konsistenz-pass + 11 llm +
  4 weitere im pipeline-Stack), 25 Test-Dateien gruen.
- Lint: 0 Errors, 2 unveraenderte Warnings (ki-panel.tsx, use-toast.ts —
  beides Bestand).
- Build: ✓ erfolgreich. Ein Cast `data as unknown as BuchungRow[]` in
  `konsistenz-pass.ts` war noetig, weil der Supabase-Client den
  Select-String nicht statisch in den Zieltyp aufloesen kann
  (Returnform `GenericStringError | T` aus dem Supabase-Generic) —
  gleiche Workaround-Form wie in `holeKenntnis`.

**Offene Entscheidungen / Trade-offs**
- **Retry-Wartezeit**: 800 ms + 200 ms Jitter ist ein Kompromiss zwischen
  Provider-Rate-Limit-Schonung und Job-Laufzeit. Bei groesseren
  Buchungs-Stapeln (> 200) koennte das zu spuerbarem Overhead werden
  (worst case: 200 × 1 s = 3 Min extra fuer Retries). Wenn das zum
  Problem wird, sollten wir den Delay auf < 500 ms reduzieren oder den
  Retry pro Buchung bei `ki_nicht_verfuegbar` direkt in den Konsistenz-
  Pass schieben (der ja sowieso eine zweite Chance liefert).
- **60%-Mehrheits-Schwelle**: bewusst defensiv. Bei 4 Buchungen heisst
  60% mind. 3 von 4 — perfekt fuer den typischen Accenture-/Enercity-
  Fall (3-4 Buchungen/Empfaenger/Monat). Bei groesseren Empfaenger-
  Gruppen (> 20 Buchungen) waere 60% evtl. zu lax — falls wir das
  beobachten, koennte ein dynamischer Schwellwert (z. B. `0.6 +
  0.005 * gesamt`) das adressieren. Aktuell: konstant.
- **Audit-Feld-Namen**: `details.vorher_kategorie_id` /
  `nachher_kategorie_id` / `mehrheit_anzahl` / `gesamt_anzahl` /
  `avg_konfidenz_mehrheit` — falls Reporting/Export auf andere
  Konventionen aufsetzt (`prior_` / `posterior_` / `count_total`),
  muessen die Feldnamen abgestimmt werden. Aktuell sind sie nur fuer
  Audit-Log + manuelle DB-Inspektion gedacht; kein UI haengt direkt
  daran.
- **Reihenfolge Retry vs. Konsistenz-Pass**: Wir retryen zuerst und
  schicken danach den Pass. Alternative waere, im Retry-Fehlerfall
  direkt einen Mini-Pass NUR fuer den betroffenen Empfaenger zu
  triggern. Verworfen, weil der Job-globale Pass am Ende dieselbe
  Wirkung mit weniger Code-Komplexitaet hat.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
