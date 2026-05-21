# Design: Lieferanten-Tab (PROJ-18)

> Brainstorming-Output für das Feature „wiederkehrende Empfänger ohne
> Abo-Muster". Inhaltlich identisch mit `features/PROJ-18-lieferanten-tab.md`;
> dieses Dokument folgt der Superpowers-Spec-Konvention für den nachfolgenden
> `writing-plans`-Lauf.

**Feature-Spec:** [features/PROJ-18-lieferanten-tab.md](../../../features/PROJ-18-lieferanten-tab.md)

---

## Problem

Der bestehende Abo-Radar (PROJ-14) erkennt nur **regelmäßige** Wiederkehr:
gleicher Empfänger, stabiler Betrag (±30 %), festes Intervall. Lieferanten
wie Aldi (Lebensmittel, schwankende Beträge) oder MediaMarkt (Wareneinkauf,
unregelmäßig) fallen durchs Raster — obwohl der Inhaber bei ihnen
regelmäßig kauft und sie idealerweise einmal als Regel hinterlegen will
("MediaMarkt → Wareneinkauf").

## Lösung

Dritter Tab "Lieferanten" in der Kategorien-Analyse, neben "Geldbewegungen"
und "Abo-Radar". Listet alle Empfänger mit ≥ 3 Buchungen im Lookback, die
**kein** Abo-Cluster bilden, gruppiert nach dominanter Klassifikation
(Geschäftlich / Privat / Unklar). Bietet dieselben Bulk-Aktionen wie der
Abo-Radar plus eine neue Aktion „Immer privat / Immer geschäftlich".

## Architektur

```
KategorienAnalyseAnsicht (bestehend)
├── Tab Geldbewegungen   (bestehend)
├── Tab Abo-Radar        (bestehend)
└── Tab Lieferanten      (NEU)
    └── LieferantenListe
        ├── SektionBlock Geschäftlich
        ├── SektionBlock Privat
        └── SektionBlock Unklar
             └── LieferantItemRow
                  └── LieferantDrilldown
                       ├── Bulk-Kategorie-Aktion
                       ├── Klassifikations-Bulk (privat / geschäftlich)
                       └── Buchungs-Tabelle mit Inline-Edit
```

Drei neue Bausteine im Code:

1. **API** `GET /api/finanzen/lieferanten` — Aggregation aus `buchung`
2. **API** `POST /api/buchungen/bulk-klassifikation` — Klassifikations-Bulk
3. **UI** `src/components/kategorien-analyse/lieferanten-liste.tsx` —
   Sektionen + Drill-Down, Pattern aus `abo-radar.tsx` übernommen
4. **Integration** in `kategorien-analyse-ansicht.tsx`: neuer Tab

Wiederverwendet ohne Änderung:
`erkenneCluster()`, `normalisiereEmpfaenger()`, `analyseFilterSchema`,
`istImBereich()`, `/api/buchungen/bulk-kategorie`, `/api/regeln`,
`/api/buchungen/[id]`, `BuchungDetailSheet`.

Empfohlene Refactor-Klammer (klein):
`lerneRegelFuer` + `regelToast` aus `abo-radar.tsx` nach
`src/lib/finanzen/regel-helper.ts` extrahieren, damit beide Tabs (Abo +
Lieferant) denselben Helper nutzen.

## Datenmodell

**Keine Migration.** Alles abgeleitet aus `buchung` (+ `kategorie`, `konto`
für Anzeige). Empfänger-Bridge über die in PROJ-15 angelegte Spalte
`empfaenger_normalisiert`, Fallback auf `normalisiereEmpfaenger()` für
Altdaten.

## Algorithmus (Lieferant-Erkennung)

1. Buchungen im Lookback laden (≥ 365 Tage, wie Abo-Radar)
2. Gruppieren nach `empfaenger_normalisiert`
3. Pro Gruppe mit ≥ 3 Buchungen:
   - `erkenneCluster()` aufrufen — wenn Cluster → Abo, überspringen
   - sonst Lieferant-Item bauen
4. `dominante_klassifikation`:
   - alle `privat` → `privat`
   - alle `geschaeftlich` → `geschaeftlich`
   - ≥ 80 % einer Seite → diese Seite
   - sonst → `unklar`
5. `dominante_kategorie` = häufigste `kategorie_id` (NULL ausgeschlossen)
6. `jahresumsatz` = `gesamt_summe * 365 / span_tage`, gekappt auf
   `gesamt_summe` wenn Span < 365 Tage
7. Sortierung pro Sektion: `jahresumsatz` absteigend

## Datenfluss

```
Tab-Click "Lieferanten"
  → GET /api/finanzen/lieferanten?...filter
  → LieferantenListe rendert 3 Sektionen
  → User klappt Item auf
  → LieferantDrilldown rendert Buchungs-Tabelle
  → User klickt "Auf alle anwenden"
  → POST /api/buchungen/bulk-kategorie
  → POST /api/regeln (idempotent über lerneRegelFuer)
  → onMutiert → Cockpit refresht
```

## Sicherheit

- owner_id-Scope: per RLS + explizit in jeder Query
- Validierung: alle neuen API-Bodies mit Zod (`bulk-klassifikation` braucht
  ein neues Schema, alle anderen Endpoints sind bestehend)
- Audit: jede Bulk-Aktion + jede gelernte Regel schreibt audit_eintrag
  (Quelle „nutzer") — bestehendes Verhalten der wiederverwendeten Endpoints

## Was bewusst NICHT zum Scope gehört (YAGNI)

- Keine `lieferant`-Tabelle in der DB
- Keine Lieferanten-Stammdaten-Seite (Adresse, Kontakt, Notizen)
- Kein Lieferant „archivieren"
- Keine Suche / Pagination (Datenmenge im Single-User-Setup unkritisch)
- Kein Export (PROJ-11 deckt das ab)
- Keine eigene Sidebar-Route (lebt im bestehenden Kategorien-Analyse-Tab)

## Test-Plan

- API:
  - 5× Aldi → erscheint als Lieferant
  - 12× Netflix monatlich → NICHT (ist Abo)
  - 2× MediaMarkt → NICHT (unter Schwelle)
  - 3× privat Aldi + 2× geschäftlich MediaMarkt für denselben normalisierten
    Empfänger → `dominante_klassifikation = 'unklar'`
- UI:
  - Drill-Down öffnet, Inline-Edit speichert
  - „Auf alle anwenden" setzt Kategorie + legt Regel an
  - „Immer privat" verschiebt Item in Sektion Privat
  - Filter reduzieren Liste plausibel
- `npm run build` ohne Type-Errors

## Risiken / offene Punkte

- **Refactor-Risiko klein:** Extraktion von `lerneRegelFuer` darf Abo-Radar
  nicht brechen — der Plan-Lauf testet das.
- **Performance-Annahme:** ≤ 20k Buchungen im Lookback ist OK. Bei
  größeren Datenmengen würde die Aggregation in der DB liegen müssen
  (Materialized View). Aktuell nicht relevant.
- **Schwelle 3** ist eine Konstante (`MIN_LIEFERANT_BUCHUNGEN`). Falls sich
  herausstellt, dass 3 zu lax/strikt ist, ist das ein One-Liner — nicht
  Teil dieser Spec.
