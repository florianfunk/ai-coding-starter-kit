# PROJ-34: Command-Palette v2 — Buchungs- & Empfänger-Volltextsuche

## Status: In Progress
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
- [ ] **AC1 — Such-API owner-scoped:** `GET /api/suche?q=` gibt für den
  eingeloggten Nutzer Top-N Buchungen (Empfänger/Buchungstext/Betrag-Match) und
  Top-N Empfänger zurück; ohne Auth 401; RLS/owner_id strikt; q<2 Zeichen →
  leere/keine Treffer ohne teuren Query. Limitiert (kein unbeschränkter Scan).
- [ ] **AC2 — Such-Logik testbar:** Die Query-Bau-/Mapping-Logik (Normalisierung
  der Eingabe, Betrag-Erkennung, Mapping DB→Ergebnis-DTO) ist als reiner Helfer
  unit-getestet, soweit ohne DB möglich.
- [ ] **AC3 — Palette-Integration:** Eingabe in der Palette löst debounced
  Server-Suche aus; Treffer erscheinen als Gruppen „Buchungen"/„Empfänger" über
  bzw. neben der bestehenden Navigation. Auswahl navigiert zum richtigen Ziel
  (Buchung in Liste/Detail; Empfänger zur Lieferanten-/gefilterten Ansicht).
- [ ] **AC4 — UX-Zustände:** Loading-Indikator während der Suche; „nichts
  gefunden" sauber; veraltete Requests werden via AbortController verworfen
  (kein Flackern alter Ergebnisse). cmdk filtert Server-Treffer nicht zusätzlich
  weg.
- [ ] **AC5 — Bestehende Palette unverändert:** Seiten-Navigation, Aktionen,
  Jahr-Wechsel (PROJ-29) funktionieren weiter; ⌘K-Hotkey-/Eingabefeld-Verhalten
  unverändert; kein Doppel-Trigger.
- [ ] **AC6 — A11y/Perf:** Tastatur-Navigation der Trefferliste funktioniert;
  Mindest-Querylänge + Debounce verhindern Query-Sturm; aria sinnvoll.
- [ ] **AC7 — Keine Regression:** tsc 0, build ok, alle Tests grün. Sicherheit:
  kein Leak fremder Daten (RLS), keine Injection (parametrisiert). Kein
  Schema/Migration nötig (optional: Trigram-Index dokumentiert, nicht gefordert).

## Implementation Notes
_(von den Agenten zu füllen)_

### Hinweise für den Agenten
- Palette: `src/components/command-palette.tsx` (cmdk via shadcn `command`).
  Server-Treffer brauchen ggf. `shouldFilter={false}` am CommandDialog/Command,
  sonst filtert cmdk die schon serverseitig gematchten Items nochmal.
- Auth-Muster aus bestehenden Routen unter `src/app/api/buchungen/` übernehmen
  (owner_id-Scope, Supabase-Server-Client).
- Sprungziel Buchung: bestehende Buchungs-/Kategorien-Ansicht mit Query-Param;
  vorhandene Routen prüfen (`/kategorien-analyse`, Buchungslisten) statt neue zu
  erfinden.
