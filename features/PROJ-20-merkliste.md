# PROJ-20 — Merkliste (Buchungen für späteres Review merken)

**Status:** In Review
**Erstellt:** 2026-06-14
**Priorität:** P2
**Design-Doc:** [docs/superpowers/specs/2026-06-14-merkliste-design.md](../docs/superpowers/specs/2026-06-14-merkliste-design.md)

## Ziel

Ein leichtgewichtiger Bookmark-Status auf Buchungen: einzelne Buchungen schnell
„merken", um sie später — ggf. nach Recherche — final zu beurteilen.
Unabhängig von der Prüfliste; ändert nichts an Status/Klassifikation.

## User Story

> Als Firmeninhaber will ich eine Buchung, die ich gerade nicht sicher
> beurteilen kann, mit einem Klick auf eine Merkliste setzen, um sie später
> gesammelt durchzugehen.

## Akzeptanzkriterien

- [x] Stern-Toggle merkt/entfernt eine Buchung (optimistisch, mit Rollback).
- [x] Einstiegspunkte: Buchungen-Ledger (Zeile + Detail-Sheet), Prüfliste
      (Zeile), Kategorien-Analyse (Detail-Sheet).
- [x] Merken ist unabhängig vom Entscheiden — eine Buchung bleibt in der
      Prüfliste und kann trotzdem gemerkt sein.
- [x] Eigene Seite `/merkliste` (Sidebar „Heute") zeigt alle gemerkten
      Buchungen, sortiert nach Merk-Zeitpunkt (zuletzt oben).
- [x] Entfernen aus der Merkliste lässt den Eintrag aus der Liste verschwinden.
- [x] Leerer Zustand mit Hinweis auf die Einstiegspunkte.

## Umsetzung

**DB:** Migration `0010_buchung_merkliste.sql` — Spalte `gemerkt_am timestamptz`
auf `buchung` + partieller Index `idx_buchung_gemerkt (owner_id, gemerkt_am desc)
where gemerkt_am is not null`. RLS unverändert (owner-scoped auf `buchung`).

**Backend:**
- `POST /api/buchungen/[id]/merkliste` `{ action: "add" | "remove" }` — setzt
  `gemerkt_am` + Audit-Eintrag (`gemerkt` / `merken_entfernt`).
- `gemerkt_am` in die Buchung-Selects der Stern-Oberflächen + Detail-Route
  aufgenommen.

**Frontend (wiederverwendbar):**
- `MerkenStern` (controlled Button) — `src/components/merkliste/merken-stern.tsx`
- `toggleMerken()` Helper — `src/lib/merken.ts`
- `useMerkSet()` Hook (optimistisch, Set-basiert) — `src/hooks/use-merk-set.ts`
- Container: Buchungen-Ledger, Prüfliste, Kategorien-Analyse-Detail-Sheet.
- Seite `/merkliste` + `MerklisteAnsicht` + Sidebar-Eintrag.

## Tests

- `npx tsc --noEmit` clean, `npm test` (621 Tests grün), `npm run build` ok
  (Route `/merkliste` registriert).

## Bewusst nicht enthalten (YAGNI)

Keine Notiz, kein Recherche-Status/Workflow, keine Priorität, kein Bulk-Merken.
Spätere Migration zu eigener `buchung_merkliste`-Tabelle möglich, falls nötig.
