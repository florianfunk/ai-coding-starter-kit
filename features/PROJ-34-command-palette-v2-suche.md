# PROJ-34: Command-Palette v2 — Buchungs- & Empfänger-Volltextsuche

## Status: Approved
**Created:** 2026-06-24
**Last Updated:** 2026-06-24
**Priorität:** P2

## Beschreibung
Die Command-Palette (PROJ-29, ⌘K) navigiert heute nur zwischen Seiten/Aktionen
und wechselt das Jahr. v2 macht sie zur **globalen Volltextsuche**: Tippt der
Inhaber einen Empfängernamen, Buchungstext oder Betrag, findet die Palette die
passenden **Buchungen** und **Empfänger** und springt direkt dorthin. Das löst
den zweiten großen Pain-Point („Suchen/Navigieren") vollständig.

Da Buchungsdaten owner-scoped, sensibel und potenziell zahlreich sind, läuft die
Suche über eine **serverseitige, debounced Such-API** (keine Massendaten in den
Client laden). Ergebnisse erscheinen als eigene Gruppen in der Palette.

## Scope (festgelegt)
- **Such-API:** `GET /api/suche?q=...` — owner-scoped, liefert Top-N Buchungen
  (Match auf Empfänger/Buchungstext/Betrag) und Top-N Empfänger
  (distinct, aus Buchungen/Empfänger-Cache). Limitiert, keine Vollscans ohne
  Grenze. Auth + RLS strikt.
- **Palette-Integration:** in `command-palette.tsx` Eingabe → debounced Fetch →
  zusätzliche Gruppen „Buchungen" und „Empfänger". Auswahl springt zur
  Buchungs-Detail-/Listen-Ansicht bzw. Lieferanten-/Empfänger-Ansicht (mit
  Filter/Query). Bestehende Navigation/Aktionen/Jahr-Gruppen bleiben.
- **UX:** Loading-/Empty-Zustände, Tastatur-Navigation der cmdk-Liste bleibt
  funktional (cmdk-Filter für serverseitige Treffer deaktivieren — `shouldFilter`
  ggf. anpassen, damit Server-Treffer nicht zusätzlich client-gefiltert werden).
- **Performance:** Debounce (~200–250 ms), Mindest-Querylänge (z. B. 2 Zeichen),
  Abbruch veralteter Requests (AbortController), Top-N (z. B. 8 je Gruppe).

## Out of Scope
- Suche über Belege/Paperless-Dokumente (spätere Iteration).
- Fuzzy-Ranking serverseitig über Volltext-Index (einfache ILIKE/Trigram reicht
  v1; FTS-Index optional dokumentieren).
- Inline-Bearbeitung aus der Palette (nur Sprung).

## User Stories
- Als Inhaber möchte ich per ⌘K direkt nach einem Empfänger oder Buchungstext
  suchen und mit einem Tastendruck zur passenden Buchung springen.

## Acceptance Criteria
- [x] **AC1 — Such-API owner-scoped:** `GET /api/suche?q=` gibt für den
  eingeloggten Nutzer Top-N Buchungen (Empfänger/Buchungstext/Betrag-Match) und
  Top-N Empfänger zurück; ohne Auth 401; RLS/owner_id strikt; q<2 Zeichen →
  leere/keine Treffer ohne teuren Query. Limitiert (kein unbeschränkter Scan).
- [x] **AC2 — Such-Logik testbar:** Die Query-Bau-/Mapping-Logik (Normalisierung
  der Eingabe, Betrag-Erkennung, Mapping DB→Ergebnis-DTO) ist als reiner Helfer
  unit-getestet, soweit ohne DB möglich.
- [x] **AC3 — Palette-Integration:** Eingabe in der Palette löst debounced
  Server-Suche aus; Treffer erscheinen als Gruppen „Buchungen"/„Empfänger" über
  bzw. neben der bestehenden Navigation. Auswahl navigiert zum richtigen Ziel
  (Buchung in Liste/Detail; Empfänger zur Lieferanten-/gefilterten Ansicht).
- [x] **AC4 — UX-Zustände:** Loading-Indikator während der Suche; „nichts
  gefunden" sauber; veraltete Requests werden via AbortController verworfen
  (kein Flackern alter Ergebnisse). cmdk filtert Server-Treffer nicht zusätzlich
  weg.
- [x] **AC5 — Bestehende Palette unverändert:** Seiten-Navigation, Aktionen,
  Jahr-Wechsel (PROJ-29) funktionieren weiter; ⌘K-Hotkey-/Eingabefeld-Verhalten
  unverändert; kein Doppel-Trigger.
- [x] **AC6 — A11y/Perf:** Tastatur-Navigation der Trefferliste funktioniert;
  Mindest-Querylänge + Debounce verhindern Query-Sturm; aria sinnvoll.
- [x] **AC7 — Keine Regression:** tsc 0, build ok, alle Tests grün. Sicherheit:
  kein Leak fremder Daten (RLS), keine Injection (parametrisiert). Kein
  Schema/Migration nötig (optional: Trigram-Index dokumentiert, nicht gefordert).

## Implementation Notes

### Geänderte/neue Dateien
- **NEU** `src/lib/suche/suche.ts` — reine Helfer: `normalisiereQuery`,
  `istSuchbar`, `erkenneBetrag` (DE/EN-Format, Vorzeichen), `ilikePattern`
  (Wildcard-Escaping `% _ \`), `mapeBuchung`, `aggregiereEmpfaenger` (distinct
  nach `empfaenger_normalisiert`, Häufigkeits-Sortierung), `leereAntwort`. DTOs
  + Konstanten `MIN_QUERY_LEN=2`, `SUCHE_LIMIT=8`.
- **NEU** `src/lib/suche/suche.test.ts` — 27 Unit-Tests (alle grün).
- **NEU** `src/app/api/suche/route.ts` — `GET /api/suche?q=`. Auth via
  `getApiUser` (401), `createClient` (Server-Cookies), `.eq("owner_id", …)`
  zusätzlich zur RLS. q<2 → sofort `{buchungen:[],empfaenger:[]}` ohne DB-Query.
- **GEÄNDERT** `src/components/command-palette.tsx` — debounced Server-Suche,
  Gruppen „Buchungen"/„Empfänger", Loading-/Empty-Zustände, AbortController.
- **GEÄNDERT** `src/components/ui/command.tsx` — `CommandDialog` akzeptiert
  optionales `commandProps`, um `shouldFilter` an das innere `<Command>`
  durchzureichen (additiv, kein Bruch bestehender Aufrufe).
- **GEÄNDERT** `src/app/(app)/buchungen/page.tsx` + `buchungen-ledger.tsx` —
  `?q=`-Param wird als initialer Client-Suchwert in den Ledger durchgereicht
  (Sprungziel der Palette füllt die vorhandene Buchungssuche vor).

### API-Vertrag
`GET /api/suche?q=<string>`
- **Auth:** Pflicht → 401 `{error}` ohne Session.
- **Query:** `q` (getrimmt, auf 100 Zeichen gekappt). q<2 Zeichen → leere Treffer
  ohne DB-Query.
- **Matching Buchungen:** `.or()` über `empfaenger.ilike`,
  `empfaenger_normalisiert.ilike`, `verwendungszweck.ilike`; bei numerischer
  Eingabe zusätzlich `betrag.eq.<n>` UND `betrag.eq.<-n>` (Ausgaben negativ).
  Sortiert nach `buchung_datum desc`, `.limit(8)`.
- **Matching Empfänger:** eigene schlanke Query (`empfaenger`,
  `empfaenger_normalisiert`), `.limit(100)`, danach distinct-Aggregation auf
  Top-8 nach Häufigkeit.
- **Response 200:**
  ```json
  {
    "buchungen": [
      { "id": "uuid", "buchung_datum": "2026-01-15", "betrag": -12.9,
        "empfaenger": "REWE", "verwendungszweck": "Einkauf" }
    ],
    "empfaenger": [
      { "name": "REWE Markt", "normalisiert": "rewe", "anzahl": 7 }
    ]
  }
  ```
- **500** `{error:"Suche fehlgeschlagen."}` bei DB-Fehler.

### Sprungziele
- **Buchung** → `/buchungen?q=<Empfänger|Verwendungszweck>` — füllt die
  vorhandene clientseitige Buchungssuche vor (springt zur passenden Zeile). Keine
  neue Seite erfunden.
- **Empfänger** → `/buchungen?q=<Empfänger>` — gefilterte Buchungsansicht des
  Empfängers (es existiert keine eigene Empfänger-Detailseite; die
  Buchungsliste mit vorgefülltem Suchwert ist das nächstliegende vorhandene
  Ziel).

### shouldFilter-Entscheidung
Der `CommandDialog` läuft mit `shouldFilter={false}` (über das neue
`commandProps`). Grund: cmdk würde die bereits serverseitig gematchten
Buchungs-/Empfänger-Items anhand ihres `value` clientseitig erneut filtern und
teils wegwerfen. Da der Filter damit deaktiviert ist, filtert die Palette die
STATISCHEN Items (Navigation/Aktionen/Jahr) selbst per Substring-Match
(`passt()`), sodass die Sprung-Navigation aus PROJ-29 unverändert funktioniert
und bei aktiver Sucheingabe sinnvoll mitgefiltert wird.

### Debounce & Abort
- Debounce 220 ms (`DEBOUNCE_MS`).
- Jeder Tastendruck bricht den laufenden Request (`AbortController.abort()`) und
  setzt einen neuen Timer; `AbortError` wird verschluckt (kein Fehlerzustand).
- Beim Schließen des Dialogs werden Eingabe/Treffer/Abort zurückgesetzt.
- Loading-Indikator (`Loader2`) nur solange noch keine Treffer vorliegen;
  Empty-State („Nichts gefunden") nur wenn nicht lädt UND nichts gefunden.

### Sicherheit
- Owner-Scope (`owner_id`) zusätzlich zur RLS (Defense-in-Depth).
- ILIKE-Pattern wird über den Supabase-Client parametrisiert; Wildcards in der
  Eingabe (`% _ \`) werden escaped → keine Wildcard-/Filter-Injection.
- Alle Queries `.limit()`-begrenzt — kein unbeschränkter Scan.

### Optionaler Performance-Index (nicht angelegt)
Für große Datenmengen empfiehlt sich ein Trigram-Index (nur Doku, NICHT Teil
dieses Features / keine Migration):
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS buchung_empfaenger_trgm
  ON buchung USING gin (empfaenger gin_trgm_ops);
CREATE INDEX IF NOT EXISTS buchung_empf_norm_trgm
  ON buchung USING gin (empfaenger_normalisiert gin_trgm_ops);
CREATE INDEX IF NOT EXISTS buchung_vwz_trgm
  ON buchung USING gin (verwendungszweck gin_trgm_ops);
```

### Verifikation
- `npx tsc --noEmit`: 0 Fehler.
- `npm run build`: erfolgreich, `/api/suche` registriert.
- `npx vitest run`: 912 passed, 1 skipped (vorbestehend).
- `eslint` auf allen geänderten Dateien: sauber.

### Hinweise für den Agenten
- Palette: `src/components/command-palette.tsx` (cmdk via shadcn `command`).
  Server-Treffer brauchen ggf. `shouldFilter={false}` am CommandDialog/Command,
  sonst filtert cmdk die schon serverseitig gematchten Items nochmal.
- Auth-Muster aus bestehenden Routen unter `src/app/api/buchungen/` übernehmen
  (owner_id-Scope, Supabase-Server-Client).
- Sprungziel Buchung: bestehende Buchungs-/Kategorien-Ansicht mit Query-Param;
  vorhandene Routen prüfen (`/kategorien-analyse`, Buchungslisten) statt neue zu
  erfinden.
