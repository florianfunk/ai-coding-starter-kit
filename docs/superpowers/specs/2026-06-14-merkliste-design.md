# PROJ-20 — Merkliste (Buchungen für späteres Review merken)

**Datum:** 2026-06-14
**Status:** In Progress

## Problem

Manche Buchungen lassen sich ohne tiefere Recherche nicht final beurteilen. Es
fehlt ein leichtgewichtiger Weg, einzelne Buchungen zu „parken" und später
gesammelt wieder anzuschauen — unabhängig von der Prüfliste.

## Lösung (schlank, YAGNI)

Reiner Bookmark-Status auf der Buchung. Kein Workflow, keine Notiz, keine
eigene Tabelle. Überall per Stern-Klick setz-/entfernbar; eine eigene
Merkliste-Seite zeigt alle gemerkten Buchungen.

### 1. Datenmodell

- Neue Spalte `gemerkt_am timestamptz NULL` auf `buchung`.
  - `NULL` = nicht gemerkt; gesetzt = auf der Merkliste (+ Zeitpunkt fürs Sortieren).
- Index `idx_buchung_gemerkt on buchung(owner_id, gemerkt_am desc)` (partial, `where gemerkt_am is not null`).
- RLS unverändert (owner-scoped bleibt wie für `buchung`).
- `Buchung`-Typ + `BuchungDetail` um `gemerkt_am: string | null` ergänzt.

### 2. Backend

- `POST /api/buchungen/[id]/merkliste` mit Body `{ action: "add" | "remove" }`.
  - Auth → UUID-Check → Ownership → `gemerkt_am = now()`/`null` → Audit-Eintrag
    (`aktion: "gemerkt" | "merken_entfernt"`, `quelle: "nutzer"`).
- `gemerkt_am` in die Buchung-Selects der Stern-Oberflächen aufnehmen
  (Buchungen-Ledger, Prüfliste, Detail-Route, neue Merkliste-Seite).

### 3. UI — wiederverwendbar

- `MerkenStern` (controlled): Stern-Icon-Button, gefüllt wenn gemerkt; Props
  `{ gemerkt, onToggle, pending?, size? }`. Reines Präsentations-Element.
- `toggleMerken(id, gewollt)` Helper in `src/lib/merken.ts` (fetch + Fehler).
- Jede Container-Ansicht hält einen `Set<string>` gemerkter IDs und macht das
  optimistische Update (mit Rollback + Toast).

Einstiegspunkte:
- **Buchungen-Ledger:** Stern pro Zeile + im Detail-Sheet (gemeinsamer Set-State).
- **Prüfliste:** Stern pro Zeile (unabhängig vom „Entscheiden").
- **Kategorien-Analyse:** Stern im Detail-Sheet (lokaler State, seeded aus `gemerkt_am`).

### 4. Merkliste-Ansicht

- Neue Seite `/merkliste` (Server Component lädt `where gemerkt_am is not null`,
  sortiert `gemerkt_am desc`), Sidebar-Eintrag unter „Heute".
- Listenansicht im Ledger-Stil; Klick öffnet das Detail-Sheet; Stern entfernt
  den Eintrag (verschwindet aus der Liste).
- Leerer Zustand mit Hinweis.

## Nicht enthalten (bewusst)

- Keine Notiz, kein Recherche-Status, keine Priorität (spätere Migration zu
  eigener Tabelle möglich, falls nötig).
- Kein Bulk-Merken.
