# PROJ-18 Lieferanten-Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third tab "Lieferanten" to the Kategorien-Analyse page that lists recurring recipients (Aldi, MediaMarkt) that are NOT subscriptions, grouped by dominant classification (Geschäftlich / Privat / Unklar), with the same bulk actions as the Abo-Radar plus a new "Always private / Always business" bulk action.

**Architecture:** All data is derived on-the-fly from the existing `buchung` table — no DB migration. A new pure-function module (`lieferanten-erkennung.ts`) groups bookings by normalized recipient, calls the existing `erkenneCluster()` to filter out subscriptions, and aggregates the rest. Two new API routes (`GET /api/finanzen/lieferanten`, `POST /api/buchungen/bulk-klassifikation`) sit on top. The UI is a new `LieferantenListe` component mirroring the section/drill-down pattern of `abo-radar.tsx`, wired into the existing tab host.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + RLS), Zod, Vitest, Tailwind, shadcn/ui, sonner toasts.

**Spec:** [features/PROJ-18-lieferanten-tab.md](../../../features/PROJ-18-lieferanten-tab.md)

---

## File Structure

**New files:**
- `src/lib/finanzen/lieferanten-erkennung.ts` — pure aggregation/grouping (no IO, no Supabase)
- `src/lib/finanzen/lieferanten-erkennung.test.ts` — unit tests for the above
- `src/lib/finanzen/regel-helper.ts` — extracted `lerneRegelFuer` + `regelToast` helpers, shared between Abo-Radar and Lieferanten
- `src/lib/validation/buchungen-klassifikation-bulk.ts` — Zod schema for `bulk-klassifikation`
- `src/app/api/finanzen/lieferanten/route.ts` — GET endpoint that loads bookings + calls the aggregator
- `src/app/api/buchungen/bulk-klassifikation/route.ts` — POST endpoint for bulk classification change
- `src/components/kategorien-analyse/lieferanten-liste.tsx` — main UI component (sections + item rows + drilldown)
- `src/components/kategorien-analyse/lieferanten-tab.tsx` — tab wrapper that fetches data, similar to `abo-radar-tab.tsx`

**Modified files:**
- `src/components/kategorien-analyse/kategorien-analyse-ansicht.tsx` — add the `lieferanten` tab
- `src/components/kategorien-analyse/abo-radar.tsx` — replace inline `lerneRegelFuer`/`regelToast` with imports from `regel-helper.ts` (no behavior change)
- `features/PROJ-18-lieferanten-tab.md` — update Status header to "In Progress" → "In Review" → "Approved" as tasks complete
- `features/INDEX.md` — keep status column in sync

**Why this split:**
- Pure algorithm in its own file = fully testable without Supabase mocks (same pattern as `wiederkehrend-erkennung.ts`)
- Helper extraction prevents copy-paste between Abo-Radar and Lieferanten
- Tab wrapper separated from list so the list is reusable / mountable in isolation
- Two routes, one schema each — small, focused, validated

---

## Task 1: Pure aggregation module — types + `gruppiereNachEmpfaenger`

**Files:**
- Create: `src/lib/finanzen/lieferanten-erkennung.ts`
- Test: `src/lib/finanzen/lieferanten-erkennung.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/finanzen/lieferanten-erkennung.test.ts`:

```typescript
// PROJ-18 — Unit-Tests für die reine Lieferanten-Aggregation. Wie bei
// wiederkehrend-erkennung.test.ts: kein Supabase, deterministisch.

import { describe, it, expect } from "vitest";
import {
  gruppiereNachEmpfaenger,
  type LieferantenBuchung,
} from "./lieferanten-erkennung";

function bu(
  id: string,
  empfaenger_normalisiert: string | null,
  empfaenger: string | null,
  buchung_datum: string,
  betrag: number,
): LieferantenBuchung {
  return {
    id,
    empfaenger_normalisiert,
    empfaenger,
    buchung_datum,
    betrag,
    klassifikation: null,
    kategorie_id: null,
    konto_id: "k1",
    status: "klassifiziert_auto",
  };
}

describe("gruppiereNachEmpfaenger", () => {
  it("gruppiert nach empfaenger_normalisiert", () => {
    const result = gruppiereNachEmpfaenger([
      bu("1", "aldi", "ALDI SUED", "2026-01-01", -10),
      bu("2", "aldi", "ALDI Süd", "2026-01-15", -12),
      bu("3", "rewe", "REWE", "2026-01-10", -8),
    ]);
    expect(result.size).toBe(2);
    expect(result.get("aldi")?.length).toBe(2);
    expect(result.get("rewe")?.length).toBe(1);
  });

  it("Fallback auf normalisiereEmpfaenger bei leerem empfaenger_normalisiert", () => {
    const result = gruppiereNachEmpfaenger([
      bu("1", "", "ALDI SUED", "2026-01-01", -10),
      bu("2", null, "ALDI Süd", "2026-01-15", -12),
    ]);
    expect(result.size).toBe(1);
    const keys = Array.from(result.keys());
    expect(keys[0]).toContain("aldi");
  });

  it("ignoriert Buchungen ohne Empfänger-Info", () => {
    const result = gruppiereNachEmpfaenger([
      bu("1", null, null, "2026-01-01", -10),
      bu("2", "", "", "2026-01-15", -12),
    ]);
    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/finanzen/lieferanten-erkennung.test.ts`
Expected: FAIL with "Cannot find module './lieferanten-erkennung'"

- [ ] **Step 3: Create the module skeleton with the grouping function**

`src/lib/finanzen/lieferanten-erkennung.ts`:

```typescript
// PROJ-18 — Reine Aggregation für den Lieferanten-Tab. Bewusst KEIN IO,
// kein Supabase, kein Zod. Wird vom API-Endpunkt aufgerufen, der die
// Buchungen aus der DB lädt.
//
// Ein "Lieferant" ist ein Empfänger mit ≥ MIN_LIEFERANT_BUCHUNGEN
// Buchungen, der KEIN Abo-Cluster bildet (siehe wiederkehrend-erkennung).
// Beispiele: Aldi (schwankende Beträge), MediaMarkt (unregelmäßig).
//
// Pipeline (siehe `erkenneLieferanten`):
//   1) Gruppieren nach empfaenger_normalisiert
//   2) Pro Gruppe: < MIN → raus; sonst erkenneCluster() → wenn Abo, raus
//   3) Rest aggregieren: dominante Klassifikation, dominante Kategorie,
//      Jahresumsatz, Richtung
//
// Lookback-Logik (mind. 365 Tage) liegt im API-Endpunkt, nicht hier.

import {
  erkenneCluster,
  modusEmpfaenger,
  MIN_BUCHUNGEN,
  tageZwischen,
  type Richtung,
} from "./wiederkehrend-erkennung";
import { normalisiereEmpfaenger } from "@/lib/classifier/normalize";
import type {
  BuchungStatus,
  KategorieTyp,
  Klassifikation,
} from "@/lib/types";

export const MIN_LIEFERANT_BUCHUNGEN = 3;
/** Anteilsschwelle: ≥ 80% einer Klassifikation → diese ist dominant. */
export const KLASSIFIKATION_DOMINANT_SCHWELLE = 0.8;

export type DominanteKlassifikation = "privat" | "geschaeftlich" | "unklar";

/** Eingangs-Form für die Aggregation. Was die API-Route liefert. */
export interface LieferantenBuchung {
  id: string;
  empfaenger: string | null;
  empfaenger_normalisiert: string | null;
  buchung_datum: string;
  betrag: number;
  klassifikation: Klassifikation | null;
  kategorie_id: string | null;
  konto_id: string;
  status: BuchungStatus;
}

/** Gruppen-Schlüssel → Liste der Buchungen dieses Empfängers. */
export function gruppiereNachEmpfaenger(
  buchungen: LieferantenBuchung[],
): Map<string, LieferantenBuchung[]> {
  const gruppen = new Map<string, LieferantenBuchung[]>();
  for (const b of buchungen) {
    const normaus = (b.empfaenger_normalisiert ?? "").trim();
    const key = normaus || normalisiereEmpfaenger(b.empfaenger);
    if (!key) continue;
    const arr = gruppen.get(key) ?? [];
    arr.push(b);
    gruppen.set(key, arr);
  }
  return gruppen;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/finanzen/lieferanten-erkennung.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/finanzen/lieferanten-erkennung.ts src/lib/finanzen/lieferanten-erkennung.test.ts
git commit -m "feat(PROJ-18): Add Lieferanten-Erkennung — Empfänger-Gruppierung"
```

---

## Task 2: Pure aggregation module — dominante Klassifikation + Kategorie

**Files:**
- Modify: `src/lib/finanzen/lieferanten-erkennung.ts`
- Modify: `src/lib/finanzen/lieferanten-erkennung.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/finanzen/lieferanten-erkennung.test.ts`:

```typescript
import {
  bestimmeDominanteKlassifikation,
  bestimmeDominanteKategorie,
} from "./lieferanten-erkennung";

describe("bestimmeDominanteKlassifikation", () => {
  it("alle privat → privat", () => {
    expect(bestimmeDominanteKlassifikation(["privat", "privat", "privat"])).toBe(
      "privat",
    );
  });
  it("alle geschäftlich → geschäftlich", () => {
    expect(
      bestimmeDominanteKlassifikation([
        "geschaeftlich",
        "geschaeftlich",
        "geschaeftlich",
      ]),
    ).toBe("geschaeftlich");
  });
  it("≥ 80% privat → privat", () => {
    expect(
      bestimmeDominanteKlassifikation([
        "privat",
        "privat",
        "privat",
        "privat",
        "geschaeftlich",
      ]),
    ).toBe("privat");
  });
  it("Mischverhältnis < 80% → unklar", () => {
    expect(
      bestimmeDominanteKlassifikation([
        "privat",
        "privat",
        "geschaeftlich",
        "geschaeftlich",
      ]),
    ).toBe("unklar");
  });
  it("null/unklar/neutral zählen nicht für die Mehrheit", () => {
    expect(
      bestimmeDominanteKlassifikation([null, "unklar", "neutral", "privat"]),
    ).toBe("unklar");
  });
  it("leere Liste → unklar", () => {
    expect(bestimmeDominanteKlassifikation([])).toBe("unklar");
  });
});

describe("bestimmeDominanteKategorie", () => {
  it("häufigste kategorie_id mit Anteil", () => {
    const result = bestimmeDominanteKategorie([
      "kat-a",
      "kat-a",
      "kat-a",
      "kat-b",
      null,
    ]);
    expect(result).toEqual({ id: "kat-a", anzahl: 3, anteil: 0.6 });
  });
  it("alle null → null", () => {
    expect(bestimmeDominanteKategorie([null, null, null])).toBeNull();
  });
  it("leere Liste → null", () => {
    expect(bestimmeDominanteKategorie([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/finanzen/lieferanten-erkennung.test.ts`
Expected: FAIL with "bestimmeDominanteKlassifikation is not exported"

- [ ] **Step 3: Implement both functions**

Append to `src/lib/finanzen/lieferanten-erkennung.ts`:

```typescript
/**
 * Mehrheitsentscheidung über `klassifikation`. Nur `privat` und
 * `geschaeftlich` zählen — null/unklar/neutral werden ignoriert.
 * Bei ≥ KLASSIFIKATION_DOMINANT_SCHWELLE (80%) Anteil einer Seite über
 * die gesamte Buchungsmenge gilt sie als dominant. Sonst `unklar`.
 */
export function bestimmeDominanteKlassifikation(
  klassifikationen: Array<Klassifikation | null>,
): DominanteKlassifikation {
  if (klassifikationen.length === 0) return "unklar";
  const gesamt = klassifikationen.length;
  let privat = 0;
  let geschaeftlich = 0;
  for (const k of klassifikationen) {
    if (k === "privat") privat++;
    else if (k === "geschaeftlich") geschaeftlich++;
  }
  if (privat / gesamt >= KLASSIFIKATION_DOMINANT_SCHWELLE) return "privat";
  if (geschaeftlich / gesamt >= KLASSIFIKATION_DOMINANT_SCHWELLE)
    return "geschaeftlich";
  return "unklar";
}

export interface DominanteKategorie {
  id: string;
  anzahl: number;
  /** Anteil 0..1 über die GESAMTE Buchungsmenge des Lieferanten. */
  anteil: number;
}

/**
 * Häufigste `kategorie_id` (NULL ausgeschlossen) mit Anteil. Bei
 * Gleichstand entscheidet die erste Vorkommen-Reihenfolge. NULL wenn
 * alle Buchungen ohne Kategorie sind.
 */
export function bestimmeDominanteKategorie(
  kategorieIds: Array<string | null>,
): DominanteKategorie | null {
  if (kategorieIds.length === 0) return null;
  const zaehler = new Map<string, number>();
  let bestId: string | null = null;
  let bestAnzahl = 0;
  for (const id of kategorieIds) {
    if (!id) continue;
    const next = (zaehler.get(id) ?? 0) + 1;
    zaehler.set(id, next);
    if (next > bestAnzahl) {
      bestAnzahl = next;
      bestId = id;
    }
  }
  if (!bestId) return null;
  return {
    id: bestId,
    anzahl: bestAnzahl,
    anteil: bestAnzahl / kategorieIds.length,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/finanzen/lieferanten-erkennung.test.ts`
Expected: PASS (all tests so far)

- [ ] **Step 5: Commit**

```bash
git add src/lib/finanzen/lieferanten-erkennung.ts src/lib/finanzen/lieferanten-erkennung.test.ts
git commit -m "feat(PROJ-18): Add Klassifikations- und Kategorie-Mehrheit"
```

---

## Task 3: Pure aggregation module — `erkenneLieferanten` (Hauptfunktion)

**Files:**
- Modify: `src/lib/finanzen/lieferanten-erkennung.ts`
- Modify: `src/lib/finanzen/lieferanten-erkennung.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/finanzen/lieferanten-erkennung.test.ts`:

```typescript
import { erkenneLieferanten } from "./lieferanten-erkennung";

function buFull(
  id: string,
  empfaenger_normalisiert: string,
  empfaenger: string,
  buchung_datum: string,
  betrag: number,
  klassifikation: Klassifikation | null = null,
  kategorie_id: string | null = null,
): LieferantenBuchung {
  return {
    id,
    empfaenger_normalisiert,
    empfaenger,
    buchung_datum,
    betrag,
    klassifikation,
    kategorie_id,
    konto_id: "k1",
    status: "klassifiziert_auto",
  };
}

// Need this import for the Klassifikation type alias used above
import type { Klassifikation } from "@/lib/types";

describe("erkenneLieferanten", () => {
  it("Aldi mit 5 schwankenden Beträgen → Lieferant", () => {
    const buchungen = [
      buFull("1", "aldi", "ALDI SUED", "2026-01-03", -23.5),
      buFull("2", "aldi", "ALDI SUED", "2026-01-19", -41.2),
      buFull("3", "aldi", "ALDI Süd", "2026-02-04", -18.0),
      buFull("4", "aldi", "ALDI", "2026-02-22", -67.4),
      buFull("5", "aldi", "ALDI SÜD", "2026-03-09", -29.9),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items.length).toBe(1);
    expect(items[0].empfaenger_norm).toBe("aldi");
    expect(items[0].anzahl).toBe(5);
    expect(items[0].richtung).toBe("ausgabe");
  });

  it("Netflix monatlich gleicher Betrag → NICHT als Lieferant (ist Abo)", () => {
    const buchungen = [
      buFull("1", "netflix", "NETFLIX", "2026-01-15", -12.99),
      buFull("2", "netflix", "NETFLIX", "2026-02-15", -12.99),
      buFull("3", "netflix", "NETFLIX", "2026-03-15", -12.99),
      buFull("4", "netflix", "NETFLIX", "2026-04-15", -12.99),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items.length).toBe(0);
  });

  it("MediaMarkt mit 2 Buchungen → unter Schwelle, NICHT als Lieferant", () => {
    const buchungen = [
      buFull("1", "mediamarkt", "MediaMarkt", "2026-01-03", -899),
      buFull("2", "mediamarkt", "MediaMarkt", "2026-04-19", -1499),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items.length).toBe(0);
  });

  it("dominante Klassifikation aus Buchungen ableiten", () => {
    const buchungen = [
      buFull("1", "aldi", "ALDI", "2026-01-03", -23.5, "privat"),
      buFull("2", "aldi", "ALDI", "2026-01-19", -41.2, "privat"),
      buFull("3", "aldi", "ALDI", "2026-02-04", -18.0, "privat"),
      buFull("4", "aldi", "ALDI", "2026-02-22", -67.4, "privat"),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items[0].dominante_klassifikation).toBe("privat");
  });

  it("gemischte Klassifikation < 80% → unklar", () => {
    const buchungen = [
      buFull("1", "aldi", "ALDI", "2026-01-03", -23.5, "privat"),
      buFull("2", "aldi", "ALDI", "2026-01-19", -41.2, "geschaeftlich"),
      buFull("3", "aldi", "ALDI", "2026-02-04", -18.0, "privat"),
      buFull("4", "aldi", "ALDI", "2026-02-22", -67.4, "geschaeftlich"),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items[0].dominante_klassifikation).toBe("unklar");
  });

  it("Jahresumsatz wird hochgerechnet bei Span < 365 Tagen", () => {
    // 4 Buchungen über ~60 Tage, Gesamtsumme 150 EUR
    // Span ≈ 60, hochgerechnet ≈ 150 * 365 / 60 ≈ 912
    const buchungen = [
      buFull("1", "aldi", "ALDI", "2026-01-01", -30),
      buFull("2", "aldi", "ALDI", "2026-01-20", -50),
      buFull("3", "aldi", "ALDI", "2026-02-10", -20),
      buFull("4", "aldi", "ALDI", "2026-03-02", -50),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items[0].gesamt_summe).toBe(150);
    expect(items[0].jahresumsatz).toBeGreaterThan(150);
    expect(items[0].jahresumsatz).toBeLessThan(1100);
  });

  it("Jahresumsatz wird NICHT unter Gesamtsumme gekappt", () => {
    // Span > 365 Tage → jahresumsatz darf < gesamt_summe sein (proportional)
    const buchungen = [
      buFull("1", "aldi", "ALDI", "2024-01-01", -100),
      buFull("2", "aldi", "ALDI", "2024-06-01", -100),
      buFull("3", "aldi", "ALDI", "2025-06-01", -100),
      buFull("4", "aldi", "ALDI", "2026-01-01", -100),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items[0].gesamt_summe).toBe(400);
    // Span ~730 Tage, also jahresumsatz ~200
    expect(items[0].jahresumsatz).toBeLessThan(400);
    expect(items[0].jahresumsatz).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/finanzen/lieferanten-erkennung.test.ts`
Expected: FAIL with "erkenneLieferanten is not exported"

- [ ] **Step 3: Implement the main function**

Append to `src/lib/finanzen/lieferanten-erkennung.ts`:

```typescript
/** Ergebnis-Item für die UI / API-Response. */
export interface LieferantItem {
  /** Häufigste Original-Schreibweise des Empfängers im Cluster. */
  empfaenger: string;
  /** Normalisierter Schlüssel — Bridge zu Regeln/anderen Features. */
  empfaenger_norm: string;
  anzahl: number;
  /** Summe ALLER Buchungen im Lookback (Absolutwert). */
  gesamt_summe: number;
  /** Hochgerechnet auf 365 Tage; bei Span < 365 entsprechend skaliert. */
  jahresumsatz: number;
  /** Mehrheits-Richtung über die Vorzeichen der Beträge. */
  richtung: Richtung;
  dominante_klassifikation: DominanteKlassifikation;
  dominante_kategorie: DominanteKategorie | null;
  /** ISO-Datum der ersten / letzten Buchung. */
  erste: string;
  letzte: string;
  /** Volle Buchungsliste, chronologisch (aufsteigend) für Drill-Down. */
  buchungen: LieferantenBuchung[];
}

/**
 * Hauptfunktion: aus einer flachen Buchungsliste die Lieferanten-Items
 * berechnen. Abos werden ausgeschlossen, indem `erkenneCluster()` für
 * jede Gruppe aufgerufen wird — gibt es ein Cluster, ist es ein Abo
 * und wandert NICHT in die Lieferanten-Liste.
 */
export function erkenneLieferanten(
  buchungen: LieferantenBuchung[],
): LieferantItem[] {
  const gruppen = gruppiereNachEmpfaenger(buchungen);
  const items: LieferantItem[] = [];

  for (const [empfaengerNorm, gruppe] of gruppen) {
    if (gruppe.length < MIN_LIEFERANT_BUCHUNGEN) continue;

    // Chronologisch sortieren — sowohl für erkenneCluster() als auch
    // für die Span-Berechnung notwendig.
    gruppe.sort((a, b) => a.buchung_datum.localeCompare(b.buchung_datum));

    // Abo-Ausschluss: wenn erkenneCluster() ein Cluster zurückgibt,
    // ist es ein Abo (lebt im Abo-Radar) und gehört NICHT hierher.
    const cluster = erkenneCluster(gruppe);
    if (cluster) continue;

    const anzahl = gruppe.length;
    const gesamtSumme = gruppe.reduce(
      (s, b) => s + Math.abs(Number(b.betrag) || 0),
      0,
    );
    const erste = gruppe[0].buchung_datum;
    const letzte = gruppe[anzahl - 1].buchung_datum;
    const spanTage = Math.max(1, tageZwischen(erste, letzte));
    // Hochrechnung auf 365 Tage; bei sehr kurzem Span begrenzen wir
    // den Skalierfaktor, damit "3 Buchungen in 7 Tagen" nicht
    // unrealistisch hochgerechnet werden.
    const skalierung = Math.min(365 / spanTage, 12);
    const jahresumsatz = Math.round(gesamtSumme * skalierung * 100) / 100;

    const positive = gruppe.filter((b) => Number(b.betrag) > 0).length;
    const richtung: Richtung =
      positive > anzahl / 2 ? "einnahme" : "ausgabe";

    const dominanteKlassifikation = bestimmeDominanteKlassifikation(
      gruppe.map((b) => b.klassifikation),
    );
    const dominanteKategorie = bestimmeDominanteKategorie(
      gruppe.map((b) => b.kategorie_id),
    );

    const anzeigeEmpfaenger =
      modusEmpfaenger(gruppe.map((b) => b.empfaenger)) || "—";

    items.push({
      empfaenger: anzeigeEmpfaenger,
      empfaenger_norm: empfaengerNorm,
      anzahl,
      gesamt_summe: Math.round(gesamtSumme * 100) / 100,
      jahresumsatz,
      richtung,
      dominante_klassifikation: dominanteKlassifikation,
      dominante_kategorie: dominanteKategorie,
      erste,
      letzte,
      buchungen: gruppe,
    });
  }

  // Sortierung: nach Jahresumsatz absteigend. Sektionierung passiert im UI.
  items.sort((a, b) => b.jahresumsatz - a.jahresumsatz);
  return items;
}

// Re-export, damit die API-Route nur aus einer Datei importieren muss.
export { MIN_BUCHUNGEN };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/finanzen/lieferanten-erkennung.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/finanzen/lieferanten-erkennung.ts src/lib/finanzen/lieferanten-erkennung.test.ts
git commit -m "feat(PROJ-18): Add erkenneLieferanten — Hauptaggregation mit Abo-Ausschluss"
```

---

## Task 4: API route `GET /api/finanzen/lieferanten`

**Files:**
- Create: `src/app/api/finanzen/lieferanten/route.ts`

- [ ] **Step 1: Read the reference implementation**

Read `src/app/api/finanzen/wiederkehrend/route.ts` (already in context) and `src/lib/auth/guard.ts` (referenced via `getApiUser`) to confirm the auth pattern.

- [ ] **Step 2: Create the route file**

`src/app/api/finanzen/lieferanten/route.ts`:

```typescript
// PROJ-18 — Lieferanten-API. Liefert wiederkehrende Empfänger OHNE
// Abo-Muster (Aldi, MediaMarkt, …). Spiegelt die Filter-/Lookback-
// Logik von /api/finanzen/wiederkehrend, damit Filter konsistent
// wirken. Die eigentliche Aggregation lebt in
// src/lib/finanzen/lieferanten-erkennung.ts (testbar ohne DB).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { analyseFilterSchema } from "@/lib/validation/kategorien-analyse";
import { istImBereich } from "@/lib/finanzen/bereich-filter";
import {
  erkenneLieferanten,
  type LieferantItem,
  type LieferantenBuchung,
} from "@/lib/finanzen/lieferanten-erkennung";
import { MIN_LOOKBACK_TAGE } from "@/lib/finanzen/wiederkehrend-erkennung";
import type { BuchungStatus, KategorieTyp, Klassifikation } from "@/lib/types";

/** Drill-Down-Repräsentation einer Buchung im Lieferanten-Tab. */
export interface LieferantBuchungAnzeige {
  id: string;
  buchung_datum: string;
  betrag: number;
  konto_id: string;
  konto_bezeichnung: string;
  kategorie_id: string | null;
  kategorie_bezeichnung: string | null;
  kategorie_typ: KategorieTyp | null;
  klassifikation: Klassifikation | null;
  status: BuchungStatus;
}

export interface LieferantItemAnzeige
  extends Omit<LieferantItem, "buchungen"> {
  /** Optionale Auflösung der dominanten Kategorie für die UI. */
  dominante_kategorie_anzeige: {
    id: string;
    bezeichnung: string;
    typ: KategorieTyp;
    anzahl: number;
    anteil: number;
  } | null;
  buchungen: LieferantBuchungAnzeige[];
}

export interface LieferantenResponse {
  items: LieferantItemAnzeige[];
  lookback: { von: string; bis: string };
}

interface BuchungRow {
  id: string;
  konto_id: string;
  buchung_datum: string;
  betrag: number;
  empfaenger: string | null;
  empfaenger_normalisiert: string | null;
  klassifikation: Klassifikation | null;
  kategorie_id: string | null;
  status: BuchungStatus;
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = analyseFilterSchema.safeParse({
    jahr: url.searchParams.get("jahr") ?? undefined,
    von: url.searchParams.get("von") ?? undefined,
    bis: url.searchParams.get("bis") ?? undefined,
    konto_id: url.searchParams.get("konto_id") ?? undefined,
    bereich: url.searchParams.get("bereich") ?? undefined,
    nur_steuerrelevant: url.searchParams.get("nur_steuerrelevant") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültiger Filter" },
      { status: 422 },
    );
  }
  const filter = parsed.data;
  const supabase = await createClient();

  // Lookback wie im Abo-Radar: min. 365 Tage.
  const bis =
    filter.bis ?? (filter.jahr ? `${filter.jahr}-12-31` : isoHeute());
  const filterVon = filter.von ?? (filter.jahr ? `${filter.jahr}-01-01` : null);
  const lookbackStart = new Date(bis);
  lookbackStart.setDate(lookbackStart.getDate() - MIN_LOOKBACK_TAGE);
  const lookbackVon =
    filterVon && filterVon < toIso(lookbackStart)
      ? filterVon
      : toIso(lookbackStart);

  let q = supabase
    .from("buchung")
    .select(
      "id, konto_id, buchung_datum, betrag, empfaenger, empfaenger_normalisiert, klassifikation, kategorie_id, status",
    )
    .eq("owner_id", user.id)
    .gte("buchung_datum", lookbackVon)
    .lte("buchung_datum", bis)
    .order("buchung_datum", { ascending: true })
    .limit(20000);
  if (filter.konto_id) q = q.eq("konto_id", filter.konto_id);

  const { data: bData, error: bErr } = await q;
  if (bErr) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  // Stammdaten parallel.
  const [{ data: kData }, { data: kontoData }] = await Promise.all([
    supabase
      .from("kategorie")
      .select("id, bezeichnung, typ")
      .eq("owner_id", user.id),
    supabase
      .from("konto")
      .select("id, bezeichnung")
      .eq("owner_id", user.id),
  ]);
  const katMap = new Map<
    string,
    { bezeichnung: string; typ: KategorieTyp }
  >(
    ((kData ?? []) as Array<{
      id: string;
      bezeichnung: string;
      typ: KategorieTyp;
    }>).map((k) => [k.id, { bezeichnung: k.bezeichnung, typ: k.typ }]),
  );
  const kontoMap = new Map<string, string>(
    ((kontoData ?? []) as Array<{ id: string; bezeichnung: string }>).map(
      (k) => [k.id, k.bezeichnung],
    ),
  );

  // Bereichs- und nur_steuerrelevant-Filter — identisch zur Wiederkehr-API.
  const buchungenGefiltert = ((bData ?? []) as BuchungRow[]).filter((b) => {
    const katInfo = b.kategorie_id ? katMap.get(b.kategorie_id) : undefined;
    if (
      !istImBereich(
        {
          klassifikation: b.klassifikation,
          kategorieTyp: katInfo?.typ ?? null,
        },
        filter.bereich,
      )
    ) {
      return false;
    }
    if (filter.nur_steuerrelevant) {
      const typ = katInfo?.typ ?? null;
      if (typ !== "einnahme" && typ !== "ausgabe") return false;
    }
    return Number(b.betrag) !== 0;
  });

  const eingang: LieferantenBuchung[] = buchungenGefiltert.map((b) => ({
    id: b.id,
    empfaenger: b.empfaenger,
    empfaenger_normalisiert: b.empfaenger_normalisiert,
    buchung_datum: b.buchung_datum,
    betrag: Number(b.betrag) || 0,
    klassifikation: b.klassifikation,
    kategorie_id: b.kategorie_id,
    konto_id: b.konto_id,
    status: b.status,
  }));

  const items = erkenneLieferanten(eingang);

  const anzeige: LieferantItemAnzeige[] = items.map((it) => {
    const domKat = it.dominante_kategorie
      ? (() => {
          const info = katMap.get(it.dominante_kategorie.id);
          if (!info) return null;
          return {
            id: it.dominante_kategorie.id,
            bezeichnung: info.bezeichnung,
            typ: info.typ,
            anzahl: it.dominante_kategorie.anzahl,
            anteil: it.dominante_kategorie.anteil,
          };
        })()
      : null;
    return {
      ...it,
      dominante_kategorie_anzeige: domKat,
      buchungen: it.buchungen.map((b) => {
        const k = b.kategorie_id ? katMap.get(b.kategorie_id) : undefined;
        return {
          id: b.id,
          buchung_datum: b.buchung_datum,
          betrag: b.betrag,
          konto_id: b.konto_id,
          konto_bezeichnung: kontoMap.get(b.konto_id) ?? "—",
          kategorie_id: b.kategorie_id,
          kategorie_bezeichnung: k?.bezeichnung ?? null,
          kategorie_typ: k?.typ ?? null,
          klassifikation: b.klassifikation,
          status: b.status,
        };
      }),
    };
  });

  const payload: LieferantenResponse = {
    items: anzeige,
    lookback: { von: lookbackVon, bis },
  };
  return NextResponse.json(payload);
}

function isoHeute(): string {
  return toIso(new Date());
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 3: Run type check + build to verify**

Run: `npm run build`
Expected: PASS (no TS errors). If build is too slow, run `npx tsc --noEmit` instead.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/finanzen/lieferanten/route.ts
git commit -m "feat(PROJ-18): Add GET /api/finanzen/lieferanten"
```

---

## Task 5: Zod schema + `POST /api/buchungen/bulk-klassifikation`

**Files:**
- Create: `src/lib/validation/buchungen-klassifikation-bulk.ts`
- Create: `src/app/api/buchungen/bulk-klassifikation/route.ts`

- [ ] **Step 1: Create the Zod schema**

`src/lib/validation/buchungen-klassifikation-bulk.ts`:

```typescript
// PROJ-18 — Bulk-Klassifikation für viele Buchungen. Eigener Endpoint
// (statt PATCH /api/buchungen/[id] in einer Schleife), damit ein
// einzelner Audit-Eintrag/INSERT-Schwung möglich ist und die UI einen
// einzelnen Toast zeigen kann.

import { z } from "zod";

export const bulkKlassifikationSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1, "Mindestens eine Buchung muss ausgewählt sein")
    .max(500, "Maximal 500 Buchungen auf einmal"),
  klassifikation: z.enum(["privat", "geschaeftlich"]),
});

export type BulkKlassifikationInput = z.input<typeof bulkKlassifikationSchema>;
export type BulkKlassifikationParsed = z.output<
  typeof bulkKlassifikationSchema
>;
```

- [ ] **Step 2: Create the route**

`src/app/api/buchungen/bulk-klassifikation/route.ts`:

```typescript
// PROJ-18 — Bulk-Klassifikation. Setzt `klassifikation` (privat |
// geschaeftlich) für viele Buchungen + setzt `status` auf
// 'manuell_bestaetigt', damit die Re-Klassifizierung das nicht
// überschreibt. `kategorie_id` und `ust_satz` werden NICHT verändert
// — der Inhaber kann die Kategorie weiterhin frei wählen.
//
// Auth: getApiUser. RLS deckt zusätzlich ab.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { bulkKlassifikationSchema } from "@/lib/validation/buchungen-klassifikation-bulk";
import type { BuchungStatus, Klassifikation } from "@/lib/types";

interface BuchungVorher {
  id: string;
  klassifikation: Klassifikation | null;
  status: BuchungStatus;
}

export interface BulkKlassifikationResponse {
  aktualisiert: number;
  uebersprungen: string[];
  klassifikation: "privat" | "geschaeftlich";
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 },
    );
  }
  const parsed = bulkKlassifikationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen" },
      { status: 422 },
    );
  }
  const { ids, klassifikation } = parsed.data;
  const supabase = await createClient();

  const { data: vorherData, error: vorherErr } = await supabase
    .from("buchung")
    .select("id, klassifikation, status")
    .eq("owner_id", user.id)
    .in("id", ids);
  if (vorherErr) {
    return NextResponse.json(
      { error: "Vorher-Snapshot fehlgeschlagen: " + vorherErr.message },
      { status: 500 },
    );
  }
  const vorher = (vorherData ?? []) as BuchungVorher[];
  const gefunden = new Set(vorher.map((b) => b.id));
  const uebersprungen = ids.filter((id) => !gefunden.has(id));

  if (vorher.length === 0) {
    return NextResponse.json({
      aktualisiert: 0,
      uebersprungen,
      klassifikation,
    } satisfies BulkKlassifikationResponse);
  }

  const updates: Record<string, unknown> = {
    klassifikation,
    status: "manuell_bestaetigt",
    quelle: "manuell",
    pruef_grund: null,
  };

  const { data: nachherData, error: updErr } = await supabase
    .from("buchung")
    .update(updates)
    .eq("owner_id", user.id)
    .in("id", Array.from(gefunden))
    .select("id, klassifikation, status");
  if (updErr) {
    return NextResponse.json(
      { error: "Bulk-Update fehlgeschlagen: " + updErr.message },
      { status: 500 },
    );
  }
  const nachher = (nachherData ?? []) as BuchungVorher[];
  const nachherMap = new Map(nachher.map((b) => [b.id, b]));

  const auditRows = vorher.map((v) => ({
    owner_id: user.id,
    entitaet: "buchung",
    entitaet_id: v.id,
    aktion: "bulk_klassifikation_gesetzt",
    quelle: "nutzer",
    details: {
      vorher: v,
      nachher: nachherMap.get(v.id) ?? null,
      klassifikation,
      bulk_size: vorher.length,
    },
  }));
  await supabase.from("audit_eintrag").insert(auditRows);

  const payload: BulkKlassifikationResponse = {
    aktualisiert: nachher.length,
    uebersprungen,
    klassifikation,
  };
  return NextResponse.json(payload);
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS (no TS errors)

- [ ] **Step 4: Commit**

```bash
git add src/lib/validation/buchungen-klassifikation-bulk.ts src/app/api/buchungen/bulk-klassifikation/route.ts
git commit -m "feat(PROJ-18): Add POST /api/buchungen/bulk-klassifikation"
```

---

## Task 6: Extract `regel-helper.ts` from Abo-Radar

**Files:**
- Create: `src/lib/finanzen/regel-helper.ts`
- Modify: `src/components/kategorien-analyse/abo-radar.tsx` (replace inline functions with imports)

This is a small refactor that lets the Lieferanten-UI reuse the regel-learning logic without copy-paste. Pure code move, no behavior change.

- [ ] **Step 1: Create the helper module**

`src/lib/finanzen/regel-helper.ts`:

```typescript
// PROJ-18 — Empfänger-Regel-Helper, gemeinsam genutzt von Abo-Radar
// (PROJ-14) und Lieferanten-Tab (PROJ-18). Idempotent: existiert
// bereits eine aktive Regel mit demselben Empfänger-Muster + derselben
// Kategorie, wird sie nicht erneut angelegt.
//
// Liefert ein Status-Flag, damit der Aufrufer den passenden Toast
// zeigen kann.

import { toast } from "sonner";
import type { KategorieTyp } from "@/lib/types";

export type RegelStatus = "angelegt" | "vorhanden" | "fehler" | "uebersprungen";

export async function lerneRegelFuer(
  empfaenger: string,
  kategorieId: string,
  kategorieTyp: KategorieTyp | null,
): Promise<RegelStatus> {
  const muster = empfaenger.trim();
  if (muster.length < 2) return "uebersprungen";

  const klassifikation: "privat" | "geschaeftlich" | "neutral" =
    kategorieTyp === "privat"
      ? "privat"
      : kategorieTyp === "neutral"
        ? "neutral"
        : "geschaeftlich";

  const rg = await fetch("/api/regeln");
  if (rg.ok) {
    const jr = (await rg.json()) as {
      data: Array<{
        bedingung: { empfaenger_muster?: string | null } | null;
        aktion: { kategorie_id?: string | null } | null;
        aktiv: boolean;
      }>;
    };
    const norm = muster.toLowerCase();
    const bestehtSchon = (jr.data ?? []).some(
      (re) =>
        re.aktiv &&
        (re.bedingung?.empfaenger_muster ?? "").toLowerCase().trim() === norm &&
        re.aktion?.kategorie_id === kategorieId,
    );
    if (bestehtSchon) return "vorhanden";
  }

  const reg = await fetch("/api/regeln", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bezeichnung: `Empfänger: ${muster}`.slice(0, 120),
      bedingung: { empfaenger_muster: muster },
      aktion: { kategorie_id: kategorieId, klassifikation },
      prioritaet: 100,
      aktiv: true,
    }),
  });
  if (reg.ok) return "angelegt";
  const e = (await reg.json().catch(() => null)) as { error?: string } | null;
  toast.warning(
    "Regel konnte nicht angelegt werden: " + (e?.error ?? `HTTP ${reg.status}`),
  );
  return "fehler";
}

/**
 * Klassifikations-only-Regel (PROJ-18): "Immer privat" / "Immer
 * geschäftlich" für einen Empfänger, ohne Kategorie-Zuweisung.
 * Idempotent über (muster, klassifikation, kategorie_id=null).
 */
export async function lerneKlassifikationsRegel(
  empfaenger: string,
  klassifikation: "privat" | "geschaeftlich",
): Promise<RegelStatus> {
  const muster = empfaenger.trim();
  if (muster.length < 2) return "uebersprungen";

  const rg = await fetch("/api/regeln");
  if (rg.ok) {
    const jr = (await rg.json()) as {
      data: Array<{
        bedingung: { empfaenger_muster?: string | null } | null;
        aktion: {
          kategorie_id?: string | null;
          klassifikation?: string | null;
        } | null;
        aktiv: boolean;
      }>;
    };
    const norm = muster.toLowerCase();
    const bestehtSchon = (jr.data ?? []).some(
      (re) =>
        re.aktiv &&
        (re.bedingung?.empfaenger_muster ?? "").toLowerCase().trim() === norm &&
        !re.aktion?.kategorie_id &&
        re.aktion?.klassifikation === klassifikation,
    );
    if (bestehtSchon) return "vorhanden";
  }

  const reg = await fetch("/api/regeln", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bezeichnung: `Empfänger: ${muster} → ${klassifikation}`.slice(0, 120),
      bedingung: { empfaenger_muster: muster },
      aktion: { klassifikation },
      prioritaet: 100,
      aktiv: true,
    }),
  });
  if (reg.ok) return "angelegt";
  const e = (await reg.json().catch(() => null)) as { error?: string } | null;
  toast.warning(
    "Regel konnte nicht angelegt werden: " + (e?.error ?? `HTTP ${reg.status}`),
  );
  return "fehler";
}

export function regelToast(
  status: RegelStatus,
  empfaenger: string,
  fallback: string,
) {
  if (status === "angelegt") {
    toast.success(`${fallback} — Regel für "${empfaenger}" gelernt`);
  } else if (status === "vorhanden") {
    toast.success(`${fallback} — passende Regel ist bereits aktiv`);
  } else {
    toast.success(fallback);
  }
}
```

- [ ] **Step 2: Update Abo-Radar to use the helper**

In `src/components/kategorien-analyse/abo-radar.tsx`:

1. Remove the inline `lerneRegelFuer` function (lines ~773-825) and `regelToast` function (lines ~827-838).
2. Add the import at the top of the file (after the other `@/` imports):

```typescript
import { lerneRegelFuer as lerneRegelFuerHelper, regelToast as regelToastHelper } from "@/lib/finanzen/regel-helper";
```

3. Replace the inline call sites: the existing `lerneRegelFuer(kategorieId, kategorieTyp)` signature takes only `(kategorieId, kategorieTyp)` — the helper takes `(empfaenger, kategorieId, kategorieTyp)`. Update each call site to pass `item.empfaenger` explicitly.

Exact edits (search and replace):

- Replace `const regelStatus = await lerneRegelFuer(b.kategorie_id, b.kategorie_typ);` with `const regelStatus = await lerneRegelFuerHelper(item.empfaenger, b.kategorie_id, b.kategorie_typ);`
- Replace `const regelStatus = await lerneRegelFuer(j.kategorie.id, j.kategorie.typ);` (TWO occurrences) with `const regelStatus = await lerneRegelFuerHelper(item.empfaenger, j.kategorie.id, j.kategorie.typ);`
- Replace `regelToast(regelStatus, "Buchung bestätigt");` with `regelToastHelper(regelStatus, item.empfaenger, "Buchung bestätigt");`
- Replace `regelToast(regelStatus,` (TWO occurrences) with `regelToastHelper(regelStatus, item.empfaenger,`

- [ ] **Step 3: Verify no behavior regression**

Run: `npx tsc --noEmit`
Expected: PASS

Manual smoke check (only if dev server is already running):
- Open `/kategorien-analyse`, switch to Abo-Radar tab, click "Bestätigen" on a row — toast appears with regel-text.

- [ ] **Step 4: Commit**

```bash
git add src/lib/finanzen/regel-helper.ts src/components/kategorien-analyse/abo-radar.tsx
git commit -m "refactor(PROJ-18): Extract regel-helper for shared use across tabs"
```

---

## Task 7: `LieferantenListe` UI component — skeleton + sections

**Files:**
- Create: `src/components/kategorien-analyse/lieferanten-liste.tsx`

This task creates the visual scaffold: three sections (Geschäftlich / Privat / Unklar), empty states, and item rows WITHOUT the drilldown yet. The drilldown comes in Task 8.

- [ ] **Step 1: Create the skeleton component**

`src/components/kategorien-analyse/lieferanten-liste.tsx`:

```typescript
"use client";

// PROJ-18 — Lieferanten-Liste mit drei Sektionen
// (Geschäftlich / Privat / Unklar). Pattern lehnt sich an
// abo-radar.tsx an, ist aber bewusst eigener Datentyp/eigene
// Komponente, damit beide Tabs unabhängig evolvieren können.

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type {
  LieferantenResponse,
  LieferantItemAnzeige,
} from "@/app/api/finanzen/lieferanten/route";

function eur(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

const KLASSIFIKATION_LABEL = {
  geschaeftlich: "Geschäftlich",
  privat: "Privat",
  unklar: "Unklar",
} as const;

const KLASSIFIKATION_ICON = {
  geschaeftlich: Briefcase,
  privat: User,
  unklar: CircleHelp,
} as const;

export function LieferantenListe({
  daten,
  onMutiert,
}: {
  daten: LieferantenResponse;
  onMutiert?: () => void;
}) {
  // Drei Sektionen, basierend auf dominanter Klassifikation.
  const sektionen = {
    geschaeftlich: daten.items.filter(
      (i) => i.dominante_klassifikation === "geschaeftlich",
    ),
    privat: daten.items.filter((i) => i.dominante_klassifikation === "privat"),
    unklar: daten.items.filter((i) => i.dominante_klassifikation === "unklar"),
  };

  const [offen, setOffen] = useState<{
    geschaeftlich: boolean;
    privat: boolean;
    unklar: boolean;
  }>({ geschaeftlich: true, privat: true, unklar: true });

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">
          Lieferanten
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Lookback {daten.lookback.von} – {daten.lookback.bis}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Empfänger mit ≥ 3 Buchungen, die kein Abo-Muster bilden. Aldi,
          MediaMarkt, Tankstelle und ähnliche.
        </p>
      </CardHeader>
      <CardContent>
        {daten.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Lieferanten erkannt — Empfänger mit ≥ 3 Buchungen ohne
            Abo-Muster erscheinen hier.
          </p>
        ) : (
          <div className="space-y-5">
            <SektionBlock
              titel="Geschäftlich"
              klassifikation="geschaeftlich"
              count={sektionen.geschaeftlich.length}
              expanded={offen.geschaeftlich}
              onToggle={() =>
                setOffen((s) => ({ ...s, geschaeftlich: !s.geschaeftlich }))
              }
            >
              {sektionen.geschaeftlich.map((item) => (
                <LieferantItemRow
                  key={item.empfaenger_norm}
                  item={item}
                  onMutiert={onMutiert}
                />
              ))}
              {sektionen.geschaeftlich.length === 0 ? (
                <SektionLeer text="Keine geschäftlichen Lieferanten erkannt." />
              ) : null}
            </SektionBlock>

            <SektionBlock
              titel="Privat"
              klassifikation="privat"
              count={sektionen.privat.length}
              expanded={offen.privat}
              onToggle={() =>
                setOffen((s) => ({ ...s, privat: !s.privat }))
              }
            >
              {sektionen.privat.map((item) => (
                <LieferantItemRow
                  key={item.empfaenger_norm}
                  item={item}
                  onMutiert={onMutiert}
                />
              ))}
              {sektionen.privat.length === 0 ? (
                <SektionLeer text="Keine privaten Lieferanten erkannt." />
              ) : null}
            </SektionBlock>

            <SektionBlock
              titel="Unklar"
              klassifikation="unklar"
              count={sektionen.unklar.length}
              expanded={offen.unklar}
              onToggle={() =>
                setOffen((s) => ({ ...s, unklar: !s.unklar }))
              }
            >
              {sektionen.unklar.map((item) => (
                <LieferantItemRow
                  key={item.empfaenger_norm}
                  item={item}
                  onMutiert={onMutiert}
                />
              ))}
              {sektionen.unklar.length === 0 ? (
                <SektionLeer text="Keine gemischten Lieferanten — alle sind eindeutig klassifiziert." />
              ) : null}
            </SektionBlock>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SektionBlock({
  titel,
  klassifikation,
  count,
  expanded,
  onToggle,
  children,
}: {
  titel: string;
  klassifikation: "geschaeftlich" | "privat" | "unklar";
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const Icon = KLASSIFIKATION_ICON[klassifikation];
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 border-b py-2 text-left transition-colors hover:bg-muted/30"
        aria-expanded={expanded}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
          {titel}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
        <span className="flex-1" />
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {expanded ? <div className="divide-y">{children}</div> : null}
    </section>
  );
}

function SektionLeer({ text }: { text: string }) {
  return (
    <div className="px-2 py-5 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function LieferantItemRow({
  item,
  onMutiert,
}: {
  item: LieferantItemAnzeige;
  onMutiert?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // onMutiert wird in Task 8 vom Drilldown genutzt — hier kein _-Prefix,
  // weil React-Komponente und ESLint die Prop akzeptiert.
  void onMutiert;
  const tintHintergrund =
    item.richtung === "einnahme" ? "bg-tint-cyan" : "bg-tint-cerise";
  const richtungFarbe =
    item.richtung === "einnahme"
      ? "text-income-strong dark:text-income"
      : "text-destructive";

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-3 py-3 pl-3 pr-2 text-left transition-all hover:brightness-95 ${tintHintergrund}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {item.empfaenger}
            </span>
            {item.dominante_kategorie_anzeige ? (
              <Badge variant="outline" className="text-[10px]">
                {item.dominante_kategorie_anzeige.bezeichnung}
                <span className="ml-1 text-muted-foreground tabular-nums">
                  {Math.round(item.dominante_kategorie_anzeige.anteil * 100)}%
                </span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                ohne Kategorie
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {item.richtung === "einnahme" ? (
              <ArrowUpRight className="h-3 w-3 text-income-strong" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-destructive" />
            )}
            <span>
              {item.anzahl}× erfasst · {item.erste} → {item.letzte}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-baseline gap-6 text-right sm:flex">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Gesamt
            </div>
            <div className="font-mono text-sm tabular-nums">
              {eur(item.gesamt_summe)}
            </div>
          </div>
          <div className="min-w-[110px]">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Jahr
            </div>
            <div
              className={`font-mono text-base font-semibold tabular-nums ${richtungFarbe}`}
            >
              {eur(item.jahresumsatz)}
            </div>
          </div>
        </div>

        <span className="shrink-0 text-muted-foreground transition-transform group-hover:text-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>

      {expanded ? (
        <div className="border-t bg-muted/20 px-2 py-3 text-xs text-muted-foreground">
          {/* Drilldown wird in Task 8 ergänzt — Platzhalter. */}
          Drilldown lädt…
        </div>
      ) : null}
    </div>
  );
}

// Re-export für Tests / andere Konsumenten, falls sie nur die
// Klassifikations-Labels brauchen, ohne die ganze Komponente zu mounten.
export { KLASSIFIKATION_LABEL };
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/kategorien-analyse/lieferanten-liste.tsx
git commit -m "feat(PROJ-18): Add LieferantenListe skeleton with sections"
```

---

## Task 8: Drilldown — Buchungs-Tabelle, Inline-Edit, Bulk-Kategorie, „Alle bestätigen & Regel lernen"

**Files:**
- Modify: `src/components/kategorien-analyse/lieferanten-liste.tsx`

- [ ] **Step 1: Add KategorieOption interface + Kategorien-Loader**

Insert near the top of `lieferanten-liste.tsx` (after the existing imports), add the `useEffect` import + extend the `useState` import — change the line:

```typescript
import { useState } from "react";
```

to:

```typescript
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCheck,
  CheckCircle2,
  Eye,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  lerneRegelFuer,
  lerneKlassifikationsRegel,
  regelToast,
} from "@/lib/finanzen/regel-helper";
import { BuchungDetailSheet } from "@/components/kategorien-analyse/buchung-detail-sheet";
import type { KategorieTyp } from "@/lib/types";
import type { BulkKategorieResponse } from "@/app/api/buchungen/bulk-kategorie/route";
import type { BulkKlassifikationResponse } from "@/app/api/buchungen/bulk-klassifikation/route";
import type {
  LieferantenResponse,
  LieferantItemAnzeige,
  LieferantBuchungAnzeige,
} from "@/app/api/finanzen/lieferanten/route";
```

Remove the now-duplicate `import { Badge }` line if it exists twice. Remove the old single-line `import { useState } from "react";`.

- [ ] **Step 2: Add `KategorieOption` interface + load Kategorien once in the top-level component**

In the `LieferantenListe` function, **before** the `sektionen` calculation, add:

```typescript
  const [kategorien, setKategorien] = useState<KategorieOption[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/kontenrahmen");
        if (r.ok) {
          const j = (await r.json()) as { data: KategorieOption[] };
          setKategorien(j.data.filter((k) => k.aktiv));
        }
      } catch {
        /* nicht hard-failen */
      }
    })();
  }, []);
```

Add the `KategorieOption` interface at module top:

```typescript
interface KategorieOption {
  id: string;
  bezeichnung: string;
  typ: KategorieTyp;
  aktiv: boolean;
}
```

Pass `kategorien` and `onOpenSheet` to every `LieferantItemRow`:

```typescript
<LieferantItemRow
  key={item.empfaenger_norm}
  item={item}
  kategorien={kategorien}
  onOpenSheet={(id) => setDetailId(id)}
  onMutiert={onMutiert}
/>
```

(Apply to all three sections.)

At the end of `LieferantenListe`'s return JSX, just before the closing `</Card>`, add:

```typescript
      <BuchungDetailSheet
        buchungId={detailId}
        kategorien={kategorien}
        onClose={() => setDetailId(null)}
        onMutiert={() => onMutiert?.()}
      />
```

- [ ] **Step 3: Extend `LieferantItemRow` props and render the drilldown**

Replace the entire `function LieferantItemRow` from the prior task with:

```typescript
function LieferantItemRow({
  item,
  kategorien,
  onOpenSheet,
  onMutiert,
}: {
  item: LieferantItemAnzeige;
  kategorien: KategorieOption[];
  onOpenSheet: (id: string) => void;
  onMutiert?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tintHintergrund =
    item.richtung === "einnahme" ? "bg-tint-cyan" : "bg-tint-cerise";
  const richtungFarbe =
    item.richtung === "einnahme"
      ? "text-income-strong dark:text-income"
      : "text-destructive";

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-3 py-3 pl-3 pr-2 text-left transition-all hover:brightness-95 ${tintHintergrund}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {item.empfaenger}
            </span>
            {item.dominante_kategorie_anzeige ? (
              <Badge variant="outline" className="text-[10px]">
                {item.dominante_kategorie_anzeige.bezeichnung}
                <span className="ml-1 text-muted-foreground tabular-nums">
                  {Math.round(item.dominante_kategorie_anzeige.anteil * 100)}%
                </span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                ohne Kategorie
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {item.richtung === "einnahme" ? (
              <ArrowUpRight className="h-3 w-3 text-income-strong" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-destructive" />
            )}
            <span>
              {item.anzahl}× erfasst · {item.erste} → {item.letzte}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-baseline gap-6 text-right sm:flex">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Gesamt
            </div>
            <div className="font-mono text-sm tabular-nums">
              {eur(item.gesamt_summe)}
            </div>
          </div>
          <div className="min-w-[110px]">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Jahr
            </div>
            <div
              className={`font-mono text-base font-semibold tabular-nums ${richtungFarbe}`}
            >
              {eur(item.jahresumsatz)}
            </div>
          </div>
        </div>

        <span className="shrink-0 text-muted-foreground transition-transform group-hover:text-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
      </button>

      {expanded ? (
        <div className="border-t bg-muted/20 px-2 py-3">
          <LieferantDrilldown
            item={item}
            kategorien={kategorien}
            onOpenSheet={onOpenSheet}
            onMutiert={onMutiert}
          />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Add the `LieferantDrilldown` component**

Append to `lieferanten-liste.tsx` (after `LieferantItemRow`):

```typescript
function LieferantDrilldown({
  item,
  kategorien,
  onOpenSheet,
  onMutiert,
}: {
  item: LieferantItemAnzeige;
  kategorien: KategorieOption[];
  onOpenSheet: (id: string) => void;
  onMutiert?: () => void;
}) {
  // Lokaler Snapshot — optimistische Updates ohne Komplett-Reload.
  const [buchungen, setBuchungen] = useState<LieferantBuchungAnzeige[]>(
    item.buchungen,
  );
  useEffect(() => setBuchungen(item.buchungen), [item.buchungen]);

  const [bulkKat, setBulkKat] = useState<string>("__none__");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkBusy, startBulk] = useTransition();
  const [klassBusy, setKlassBusy] = useState<
    "privat" | "geschaeftlich" | null
  >(null);

  const distinct = new Set(buchungen.map((b) => b.kategorie_id ?? "__none__"));
  const alleGleicheKategorie = distinct.size === 1;
  const aktuelleKategorieId =
    alleGleicheKategorie && !distinct.has("__none__")
      ? Array.from(distinct)[0]
      : null;

  async function aendereEinzeln(b: LieferantBuchungAnzeige, neueId: string) {
    if (neueId === b.kategorie_id) return;
    setSavingId(b.id);
    try {
      const r = await fetch(`/api/buchungen/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kategorie_id: neueId, bestaetigen: true }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      const neueKat = kategorien.find((k) => k.id === neueId);
      setBuchungen((bs) =>
        bs.map((x) =>
          x.id === b.id
            ? {
                ...x,
                kategorie_id: neueId,
                kategorie_bezeichnung: neueKat?.bezeichnung ?? null,
                kategorie_typ: neueKat?.typ ?? null,
                status: "manuell_bestaetigt",
              }
            : x,
        ),
      );
      toast.success("Kategorie geändert");
      onMutiert?.();
    } catch (e) {
      toast.error("Fehler: " + (e instanceof Error ? e.message : "unbekannt"));
    } finally {
      setSavingId(null);
    }
  }

  function wendeAufAlleAn() {
    if (bulkKat === "__none__") {
      toast.error("Bitte eine Kategorie auswählen.");
      return;
    }
    const ids = buchungen.map((b) => b.id);
    startBulk(async () => {
      try {
        const r = await fetch("/api/buchungen/bulk-kategorie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, kategorie_id: bulkKat }),
        });
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        const j = (await r.json()) as BulkKategorieResponse;
        setBuchungen((bs) =>
          bs.map((b) => ({
            ...b,
            kategorie_id: j.kategorie.id,
            kategorie_bezeichnung: j.kategorie.bezeichnung,
            kategorie_typ: j.kategorie.typ,
            status: "manuell_bestaetigt",
          })),
        );

        const regelStatus = await lerneRegelFuer(
          item.empfaenger,
          j.kategorie.id,
          j.kategorie.typ,
        );
        regelToast(
          regelStatus,
          item.empfaenger,
          `${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} auf "${j.kategorie.bezeichnung}" gesetzt`,
        );
        onMutiert?.();
      } catch (e) {
        toast.error(
          "Bulk-Update fehlgeschlagen: " +
            (e instanceof Error ? e.message : "unbekannt"),
        );
      }
    });
  }

  function alleBestaetigenMitRegel() {
    if (!alleGleicheKategorie || !aktuelleKategorieId) {
      toast.error(
        "Geht nur, wenn alle Buchungen dieselbe Kategorie haben. Vorher 'auf alle anwenden' nutzen.",
      );
      return;
    }
    startBulk(async () => {
      try {
        const ids = buchungen.map((b) => b.id);
        const r = await fetch("/api/buchungen/bulk-kategorie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, kategorie_id: aktuelleKategorieId }),
        });
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        const j = (await r.json()) as BulkKategorieResponse;
        setBuchungen((bs) =>
          bs.map((b) => ({
            ...b,
            kategorie_id: j.kategorie.id,
            kategorie_bezeichnung: j.kategorie.bezeichnung,
            kategorie_typ: j.kategorie.typ,
            status: "manuell_bestaetigt",
          })),
        );

        const regelStatus = await lerneRegelFuer(
          item.empfaenger,
          j.kategorie.id,
          j.kategorie.typ,
        );
        regelToast(
          regelStatus,
          item.empfaenger,
          `Alle ${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} bestätigt`,
        );
        onMutiert?.();
      } catch (e) {
        toast.error(
          "Alle bestätigen fehlgeschlagen: " +
            (e instanceof Error ? e.message : "unbekannt"),
        );
      }
    });
  }

  async function setzeKlassifikationPauschal(
    klass: "privat" | "geschaeftlich",
  ) {
    setKlassBusy(klass);
    try {
      const ids = buchungen.map((b) => b.id);
      const r = await fetch("/api/buchungen/bulk-klassifikation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, klassifikation: klass }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as BulkKlassifikationResponse;
      setBuchungen((bs) =>
        bs.map((b) => ({
          ...b,
          klassifikation: j.klassifikation,
          status: "manuell_bestaetigt",
        })),
      );

      const regelStatus = await lerneKlassifikationsRegel(item.empfaenger, klass);
      regelToast(
        regelStatus,
        item.empfaenger,
        `${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} als ${klass === "privat" ? "privat" : "geschäftlich"} markiert`,
      );
      onMutiert?.();
    } catch (e) {
      toast.error(
        "Klassifikation fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setKlassBusy(null);
    }
  }

  return (
    <div className="space-y-3 px-2">
      {/* Klassifikations-Aktion */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Pauschal markieren
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setzeKlassifikationPauschal("privat")}
            disabled={klassBusy !== null}
            title={`Alle ${buchungen.length} als privat markieren + Regel anlegen`}
          >
            {klassBusy === "privat" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <User className="mr-1.5 h-3.5 w-3.5" />
            )}
            Immer privat
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setzeKlassifikationPauschal("geschaeftlich")}
            disabled={klassBusy !== null}
            title={`Alle ${buchungen.length} als geschäftlich markieren + Regel anlegen`}
          >
            {klassBusy === "geschaeftlich" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Briefcase className="mr-1.5 h-3.5 w-3.5" />
            )}
            Immer geschäftlich
          </Button>
        </div>
      </div>

      {/* Bulk-Kategorie-Aktion */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-background p-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Kategorie auf alle anwenden
          </div>
          <div className="flex items-center gap-2">
            <Select value={bulkKat} onValueChange={setBulkKat}>
              <SelectTrigger className="h-9 w-[280px] text-sm">
                <SelectValue placeholder="Kategorie wählen…" />
              </SelectTrigger>
              <SelectContent>
                <KategorieGruppen kategorien={kategorien} />
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={wendeAufAlleAn}
              disabled={bulkBusy || bulkKat === "__none__"}
            >
              {bulkBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Auf alle {buchungen.length} anwenden
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={alleBestaetigenMitRegel}
              disabled={
                bulkBusy || !alleGleicheKategorie || !aktuelleKategorieId
              }
              title={
                !alleGleicheKategorie
                  ? "Buchungen haben uneinheitliche Kategorien — vorher 'auf alle anwenden' nutzen"
                  : !aktuelleKategorieId
                    ? "Es ist keine Kategorie gesetzt"
                    : `Alle ${buchungen.length} bestätigen und Regel für "${item.empfaenger}" lernen`
              }
            >
              {bulkBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              )}
              Alle bestätigen & Regel lernen
            </Button>
          </div>
        </div>
      </div>

      {/* Buchungs-Liste */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Datum</TableHead>
            <TableHead className="w-[120px]">Konto</TableHead>
            <TableHead className="text-right w-[110px]">Betrag</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead className="w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buchungen.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="tabular-nums text-sm">
                {b.buchung_datum}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {b.konto_bezeichnung}
              </TableCell>
              <TableCell
                className={
                  "text-right tabular-nums font-mono text-sm " +
                  (b.betrag < 0
                    ? "text-destructive"
                    : "text-income-strong dark:text-income")
                }
              >
                {eur(b.betrag)}
              </TableCell>
              <TableCell>
                <Select
                  disabled={savingId === b.id}
                  value={b.kategorie_id ?? "__none__"}
                  onValueChange={(v) =>
                    v !== "__none__" && aendereEinzeln(b, v)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue
                      placeholder={b.kategorie_bezeichnung ?? "— ohne —"}
                    >
                      <span className="truncate">
                        {b.kategorie_bezeichnung ?? "— ohne —"}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <KategorieGruppen kategorien={kategorien} />
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onOpenSheet(b.id)}
                  title="Volle Details öffnen"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function KategorieGruppen({
  kategorien,
}: {
  kategorien: KategorieOption[];
}) {
  const gruppen: Record<KategorieTyp, KategorieOption[]> = {
    einnahme: [],
    ausgabe: [],
    privat: [],
    neutral: [],
  };
  for (const k of kategorien) gruppen[k.typ].push(k);
  const labels: Record<KategorieTyp, string> = {
    einnahme: "Einnahmen",
    ausgabe: "Ausgaben",
    privat: "Privat",
    neutral: "Neutral",
  };
  const reihenfolge: KategorieTyp[] = [
    "einnahme",
    "ausgabe",
    "privat",
    "neutral",
  ];
  return (
    <>
      {reihenfolge.map((typ) =>
        gruppen[typ].length === 0 ? null : (
          <SelectGroup key={typ}>
            <SelectLabel>{labels[typ]}</SelectLabel>
            {gruppen[typ]
              .slice()
              .sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung))
              .map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.bezeichnung}
                </SelectItem>
              ))}
          </SelectGroup>
        ),
      )}
    </>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/kategorien-analyse/lieferanten-liste.tsx
git commit -m "feat(PROJ-18): Add LieferantDrilldown with bulk + classification actions"
```

---

## Task 9: Tab wrapper `LieferantenTab`

**Files:**
- Create: `src/components/kategorien-analyse/lieferanten-tab.tsx`

- [ ] **Step 1: Create the wrapper**

`src/components/kategorien-analyse/lieferanten-tab.tsx`:

```typescript
"use client";

// PROJ-18 — Tab-Wrapper für die Lieferanten-Liste. Lädt die Daten beim
// Mount (und bei Filter-Änderung) und reicht sie an `LieferantenListe`
// weiter. Analog zu abo-radar-tab.tsx.

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { LieferantenListe } from "@/components/kategorien-analyse/lieferanten-liste";
import type { Bereich } from "@/lib/validation/kategorien-analyse";
import type { LieferantenResponse } from "@/app/api/finanzen/lieferanten/route";

export interface LieferantenTabFilter {
  von: string | null;
  bis: string | null;
  kontoId: string | null;
  bereich: Bereich;
  nurSteuerrelevant?: boolean;
}

export function LieferantenTab({ filter }: { filter: LieferantenTabFilter }) {
  const [daten, setDaten] = useState<LieferantenResponse | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ladeDaten = useCallback(() => {
    setFehler(null);
    const params = new URLSearchParams();
    if (filter.von) params.set("von", filter.von);
    if (filter.bis) params.set("bis", filter.bis);
    if (filter.kontoId) params.set("konto_id", filter.kontoId);
    if (filter.bereich !== "alle") params.set("bereich", filter.bereich);
    if (filter.nurSteuerrelevant) params.set("nur_steuerrelevant", "true");
    startTransition(async () => {
      try {
        const r = await fetch(`/api/finanzen/lieferanten?${params.toString()}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setDaten((await r.json()) as LieferantenResponse);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        setFehler(msg);
        toast.error("Lieferanten konnten nicht geladen werden: " + msg);
      }
    });
  }, [
    filter.von,
    filter.bis,
    filter.kontoId,
    filter.bereich,
    filter.nurSteuerrelevant,
  ]);

  useEffect(() => {
    ladeDaten();
  }, [ladeDaten]);

  if (fehler) {
    return <p className="text-sm text-destructive">{fehler}</p>;
  }
  if (!daten) {
    return (
      <p className="text-sm text-muted-foreground">
        {isPending ? "Lade Lieferanten…" : "Keine Daten."}
      </p>
    );
  }

  return <LieferantenListe daten={daten} onMutiert={ladeDaten} />;
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/kategorien-analyse/lieferanten-tab.tsx
git commit -m "feat(PROJ-18): Add LieferantenTab wrapper with lazy data load"
```

---

## Task 10: Wire the tab into `KategorienAnalyseAnsicht`

**Files:**
- Modify: `src/components/kategorien-analyse/kategorien-analyse-ansicht.tsx`

- [ ] **Step 1: Add the import**

After the existing import block in the file (after the line importing `AboRadarTab`), add:

```typescript
import { LieferantenTab } from "@/components/kategorien-analyse/lieferanten-tab";
```

- [ ] **Step 2: Extend the `Tab` type**

Change:

```typescript
type Tab = "geschaeft" | "privat" | "bewegungen" | "abos" | "cockpit";
```

to:

```typescript
type Tab =
  | "geschaeft"
  | "privat"
  | "bewegungen"
  | "abos"
  | "lieferanten"
  | "cockpit";
```

- [ ] **Step 3: Extend `istKontoSicht` to include the new tab**

Change:

```typescript
const istKontoSicht =
  tab === "cockpit" || tab === "bewegungen" || tab === "abos";
```

to:

```typescript
const istKontoSicht =
  tab === "cockpit" ||
  tab === "bewegungen" ||
  tab === "abos" ||
  tab === "lieferanten";
```

- [ ] **Step 4: Add the `TabsTrigger` and `TabsContent`**

Inside `<TabsList>`, after `<TabsTrigger value="abos">Abo-Radar</TabsTrigger>`, add:

```typescript
<TabsTrigger value="lieferanten">Lieferanten</TabsTrigger>
```

After `<TabsContent value="abos" …>…</TabsContent>`, add:

```typescript
<TabsContent value="lieferanten" className="mt-6">
  <LieferantenTab
    filter={{
      von: zeitraum.von,
      bis: zeitraum.bis,
      kontoId: kontoId === "alle" ? null : kontoId,
      bereich: "alle",
      nurSteuerrelevant,
    }}
  />
</TabsContent>
```

- [ ] **Step 5: Update feature spec + INDEX status to "In Progress"**

Edit `features/PROJ-18-lieferanten-tab.md` header:

Change `## Status: Planned` → `## Status: In Progress` and bump `**Last Updated:** 2026-05-21` (it's still today, but writing it explicitly satisfies the rule).

Edit `features/INDEX.md`: change PROJ-18 status from `Planned` to `In Progress`.

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/kategorien-analyse/kategorien-analyse-ansicht.tsx features/PROJ-18-lieferanten-tab.md features/INDEX.md
git commit -m "feat(PROJ-18): Wire Lieferanten tab into Kategorien-Analyse"
```

---

## Task 11: Manual smoke test + status update to "In Review"

**Files:**
- Modify: `features/PROJ-18-lieferanten-tab.md`
- Modify: `features/INDEX.md`

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server up on http://localhost:3000

- [ ] **Step 2: Smoke checklist (manual)**

Open `/kategorien-analyse` in the browser, log in if needed, then:

- [ ] Tab "Lieferanten" appears next to "Abo-Radar"
- [ ] Click tab — data loads, no console errors, no toast errors
- [ ] Three sections render (Geschäftlich / Privat / Unklar) with counts
- [ ] An empty section shows the empty-state text
- [ ] Click on a Lieferant row — drilldown expands, shows the booking table
- [ ] Click "Immer privat" on a Lieferant — toast appears, item moves into the Privat section after refetch
- [ ] Click "Auf alle anwenden" with a selected category — bookings get the new category, regel-learned toast appears
- [ ] Change the konto filter — list reduces accordingly
- [ ] Change the zeitraum to a single month — list still works (lookback ensures ≥ 365 days of context)
- [ ] Eye-icon opens the BuchungDetailSheet

- [ ] **Step 3: Verify the Abo-Radar still works (regression check from Task 6)**

- [ ] Tab "Abo-Radar" still renders all sections
- [ ] "Bestätigen" + "Für alle" still create regel-toasts

- [ ] **Step 4: Run the full test suite**

Run: `npm test -- --run`
Expected: PASS, all existing tests + new lieferanten-erkennung tests

- [ ] **Step 5: Run the production build**

Run: `npm run build`
Expected: PASS, no TS errors, no lint errors

- [ ] **Step 6: Update feature status to "In Review"**

Edit `features/PROJ-18-lieferanten-tab.md`: `## Status: In Progress` → `## Status: In Review`
Edit `features/INDEX.md`: PROJ-18 status `In Progress` → `In Review`

Also append a brief implementation note in `features/PROJ-18-lieferanten-tab.md` under `## Implementierungsnotizen`:

```markdown
- API + UI implementiert wie geplant; keine DB-Migration
- `lerneRegelFuer` aus abo-radar.tsx in `src/lib/finanzen/regel-helper.ts` extrahiert + um `lerneKlassifikationsRegel` ergänzt
- Bulk-Klassifikation als eigener Endpoint `/api/buchungen/bulk-klassifikation` (Schema in `buchungen-klassifikation-bulk.ts`)
- Unit-Tests in `src/lib/finanzen/lieferanten-erkennung.test.ts` decken die Aggregation ab (Gruppierung, Klassifikations-Mehrheit, dominante Kategorie, Abo-Ausschluss, Jahresumsatz-Hochrechnung)
```

- [ ] **Step 7: Commit**

```bash
git add features/PROJ-18-lieferanten-tab.md features/INDEX.md
git commit -m "docs(PROJ-18): Mark Lieferanten-Tab as In Review after smoke test"
```

---

## Self-Review (für den Plan-Autor — bereits ausgeführt)

**Spec coverage check (Acceptance Criteria):**
- Neuer Tab "Lieferanten" → Task 10
- Filter konsistent → Task 4 (Endpoint übernimmt `analyseFilterSchema`) + Task 9 (Tab reicht durch)
- API `GET /api/finanzen/lieferanten` mit ≥ 3 Buchungen + ohne Abo-Cluster → Task 3 + 4
- Drei Sektionen Geschäftlich/Privat/Unklar → Task 7
- Sortierung nach Jahresumsatz absteigend → Task 3 (sortiert in `erkenneLieferanten`)
- Item-Zeile mit Empfänger/Anzahl/Gesamt/Jahr/Kategorie-Chip → Task 7 + 8
- Drill-Down mit Inline-Kategorie + Status + Aktionen → Task 8
- Bulk "Kategorie auf alle" + "Alle bestätigen & Regel lernen" → Task 8
- "Immer privat / Immer geschäftlich" → Task 5 (Endpoint) + Task 6 (Helper) + Task 8 (UI)
- Empty-State-Text → Task 7
- Abos werden ausgeschlossen → Task 3 (Test "Netflix → NICHT als Lieferant")

**Placeholder scan:** Keine TBDs, keine "implement later". Alle Code-Schritte enthalten vollständigen Code.

**Type consistency:**
- `LieferantenBuchung` (Task 1) wird in `erkenneLieferanten` (Task 3) und in der Route (Task 4) korrekt verwendet.
- `LieferantItem` (Task 3) → `LieferantItemAnzeige` (Task 4, erweitert um `dominante_kategorie_anzeige` und `LieferantBuchungAnzeige[]`).
- `lerneRegelFuer` Helper-Signatur `(empfaenger, kategorieId, kategorieTyp)` (Task 6) wird in Abo-Radar (Task 6 Step 2) und Lieferanten-UI (Task 8) identisch verwendet.
- `regelToast(status, empfaenger, fallback)` (Task 6) — gleiche Aufruf-Reihenfolge an allen Call-Sites.
- `BulkKlassifikationResponse.klassifikation: 'privat' | 'geschaeftlich'` (Task 5) → in der UI in `setBuchungen` korrekt zugewiesen (Task 8).

Plan ist bereit zur Ausführung.
