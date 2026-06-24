// PROJ-33 — Korrektheit der begrenzten Nebenläufigkeit.
//
// Belegt die harten Invarianten der parallelisierten Klassifizierung, ohne die
// API-Route (mit Auth/DB) zu starten:
//  - AC2: serielles vs. paralleles Ergebnis pro Buchung identisch.
//  - AC3: N Buchungen mit demselben unbekannten Empfänger teilen unter
//         mapMitLimit-Nebenläufigkeit genau EINEN Recherche-Call.
//  - AC4: Aggregation der Teil-Ergebnisse (wie in route.ts) ergibt exakte
//         Zählersummen (keine Doppel-/Verlustzählung).
//
// Die Tests fahren denselben Datenfluss wie route.ts: pro Buchung
// `klassifiziereBuchung`, danach werden Teil-Ergebnisse aggregiert. Die DB
// wird gemockt; die InflightMap ist real (job-scoped).

import { describe, it, expect, vi } from "vitest";
import {
  klassifiziereBuchung,
  DEFAULT_CONFIG,
  type BuchungFuerPipeline,
} from "./pipeline";
import { neueInflightMap } from "./empfaenger-cache";
import { mapMitLimit } from "@/lib/util/map-mit-limit";
import type { LlmErgebnis, KategorieOption } from "./llm";

const kategorien: KategorieOption[] = [
  { id: "kat-soft", bezeichnung: "Software", typ: "ausgabe" },
];

function buchung(p: Partial<BuchungFuerPipeline> = {}): BuchungFuerPipeline {
  return {
    id: p.id ?? "b1",
    konto_id: p.konto_id ?? "k1",
    betrag: p.betrag ?? -50,
    verwendungszweck: p.verwendungszweck ?? "Testzweck",
    empfaenger: p.empfaenger ?? "Test GmbH",
    status: p.status ?? "offen",
    empfaenger_normalisiert: p.empfaenger_normalisiert ?? "",
  };
}

function llmOk(over: Partial<LlmErgebnis> = {}): LlmErgebnis {
  return {
    klassifikation: "geschaeftlich",
    steuerrelevant: true,
    kategorie_id: "kat-soft",
    ust_satz: 19,
    begruendung: "Software-Abo, betrieblich.",
    konfidenz: 0.95,
    ...over,
  };
}

interface CacheRow {
  owner_id: string;
  empfaenger_norm: string;
  [k: string]: unknown;
}

/**
 * Minimaler Supabase-Mock (analog pipeline.test.ts), reduziert auf das, was
 * `klassifiziereBuchung` aufruft: empfaenger_kenntnis (select/upsert/update/
 * insert), buchung.select (Historie), audit_eintrag.insert.
 */
function makeSupabase(opts: { cache?: CacheRow[] } = {}) {
  const cache = new Map<string, CacheRow>();
  for (const c of opts.cache ?? []) {
    cache.set(`${c.owner_id}::${c.empfaenger_norm}`, c);
  }

  function buildKenntnisChain() {
    const filter: { owner_id?: string; empfaenger_norm?: string } = {};
    const chain = {
      eq: (col: string, val: string) => {
        if (col === "owner_id") filter.owner_id = val;
        if (col === "empfaenger_norm") filter.empfaenger_norm = val;
        return chain;
      },
      maybeSingle: async () => {
        const key = `${filter.owner_id ?? ""}::${filter.empfaenger_norm ?? ""}`;
        return { data: cache.get(key) ?? null, error: null };
      },
    };
    return chain;
  }

  const from = vi.fn((tabelle: string) => {
    if (tabelle === "empfaenger_kenntnis") {
      return {
        select: vi.fn(() => buildKenntnisChain()),
        upsert: vi.fn(async (row: CacheRow) => {
          cache.set(`${row.owner_id}::${row.empfaenger_norm}`, { ...row });
          return { error: null };
        }),
        update: vi.fn(() => ({
          eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
        })),
        insert: vi.fn(async () => ({ error: null })),
      };
    }
    if (tabelle === "buchung") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
    }
    if (tabelle === "audit_eintrag") {
      return { insert: vi.fn(async () => ({ error: null })) };
    }
    throw new Error(`Unerwartete Tabelle im Mock: ${tabelle}`);
  });

  return { from };
}

describe("PROJ-33 — AC2: serielles vs. paralleles Ergebnis identisch", () => {
  it("liefert pro Buchung dasselbe Ergebnis, egal ob seriell oder parallel", async () => {
    const eingaben = [
      buchung({ id: "b1", betrag: -10, empfaenger: "A GmbH", empfaenger_normalisiert: "a" }),
      buchung({ id: "b2", betrag: -3000, empfaenger: "B GmbH", empfaenger_normalisiert: "b" }), // Ausreißer
      buchung({ id: "b3", betrag: -20, empfaenger: "C GmbH", empfaenger_normalisiert: "c" }),
      buchung({ id: "b4", betrag: -7, empfaenger: "D GmbH", empfaenger_normalisiert: "d" }),
      buchung({ id: "b5", betrag: -99, empfaenger: "E GmbH", empfaenger_normalisiert: "e" }),
    ];
    // Deterministisches, eingangsabhängiges LLM (kein Zufall, keine
    // Reihenfolge-Abhängigkeit).
    const llmFn = vi.fn(async (e: { betrag: number }) =>
      llmOk({ konfidenz: Math.abs(e.betrag) > 50 ? 0.7 : 0.95 }),
    );
    const rechercheFn = vi.fn(async () => null);
    const extrahiereFn = vi.fn(async () => null);

    async function lauf(limit: number) {
      const supa = makeSupabase({ cache: [] });
      const inflight = neueInflightMap();
      const r = await mapMitLimit(eingaben, limit, async (b) => {
        const { ergebnis } = await klassifiziereBuchung(
          b,
          [],
          kategorien,
          DEFAULT_CONFIG,
          llmFn,
          rechercheFn,
          { supabase: { from: supa.from } as never, ownerId: "owner-1", inflight },
          extrahiereFn,
        );
        return {
          id: b.id,
          status: ergebnis.status,
          quelle: ergebnis.quelle,
          kategorie_id: ergebnis.kategorie_id,
          konfidenz: ergebnis.konfidenz,
          pruef_grund: ergebnis.pruef_grund,
        };
      });
      return r.ergebnisse;
    }

    const seriell = await lauf(1);
    const parallel = await lauf(5);

    expect(parallel).toEqual(seriell);
    // Sanity: b2 (Ausreißer) und b5 (Konfidenz 0.95 aber betrag 99 → 0.7) zur Prüfung,
    // kleine Beträge auto.
    const byId = Object.fromEntries(seriell.map((e) => [e.id, e]));
    expect(byId.b1.status).toBe("auto_verbucht");
    expect(byId.b2.status).toBe("zur_pruefung");
  });
});

describe("PROJ-33 — AC3: InflightMap unter Nebenläufigkeit (kein Thundering Herd)", () => {
  it("N Buchungen mit gleichem unbekanntem Empfänger → genau EIN Recherche-Call", async () => {
    const supa = makeSupabase({ cache: [] });
    const inflight = neueInflightMap();

    // Recherche mit Delay, damit alle Tasks gleichzeitig im Inflight-Status
    // sind, bevor der erste Call resolved.
    const rechercheFn = vi.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                query: "Acme GmbH Deutschland",
                treffer: [
                  { titel: "Acme", beschreibung: "Software.", url: "https://acme.example" },
                ],
              }),
            20,
          ),
        ),
    );
    const extrahiereFn = vi.fn(async () => ({ branche: "Software", leistung: "SaaS." }));
    const llmFn = vi.fn(async () => llmOk());

    // 25 Buchungen, alle derselbe (recherchewürdige) Empfänger.
    const eingaben = Array.from({ length: 25 }, (_, i) =>
      buchung({ id: `b${i}`, empfaenger: "Acme GmbH", empfaenger_normalisiert: "acme" }),
    );

    const r = await mapMitLimit(eingaben, 5, async (b) => {
      const { ergebnis } = await klassifiziereBuchung(
        b,
        [],
        kategorien,
        DEFAULT_CONFIG,
        llmFn,
        rechercheFn as never,
        { supabase: { from: supa.from } as never, ownerId: "owner-1", inflight },
        extrahiereFn,
      );
      return ergebnis.status;
    });

    // Trotz 25 parallel laufender Tasks: EIN Recherche- und EIN Extraktions-Call.
    expect(rechercheFn).toHaveBeenCalledOnce();
    expect(extrahiereFn).toHaveBeenCalledOnce();
    expect(r.ergebnisse).toHaveLength(25);
    expect(r.ergebnisse.every((s) => s === "auto_verbucht")).toBe(true);
  });
});

describe("PROJ-33 — AC4: Zähler-Aggregation exakt", () => {
  it("Summe der Zähler == Anzahl verarbeiteter Buchungen, keine Doppel-/Verlustzählung", async () => {
    const supa = makeSupabase({ cache: [] });
    const inflight = neueInflightMap();
    const rechercheFn = vi.fn(async () => null);
    const extrahiereFn = vi.fn(async () => null);
    const llmFn = vi.fn(async (e: { betrag: number }) =>
      // betrag -50 → auto (0.95), betrag -200 → zur Prüfung (0.6)
      llmOk({ konfidenz: Math.abs(e.betrag) > 100 ? 0.6 : 0.95 }),
    );

    const eingaben = Array.from({ length: 30 }, (_, i) =>
      buchung({
        id: `b${i}`,
        betrag: i % 2 === 0 ? -50 : -200,
        empfaenger: `Firma ${i} GmbH`,
        empfaenger_normalisiert: `firma${i}`,
      }),
    );

    // Datenfluss wie route.ts: pro Buchung Teil-Ergebnis, danach aggregieren.
    type Teil = {
      verarbeitet: boolean;
      auto_verbucht: boolean;
      quelle: string;
    };
    const r = await mapMitLimit<BuchungFuerPipeline, Teil>(
      eingaben,
      5,
      async (b) => {
        const { ergebnis } = await klassifiziereBuchung(
          b,
          [],
          kategorien,
          DEFAULT_CONFIG,
          llmFn,
          rechercheFn,
          { supabase: { from: supa.from } as never, ownerId: "owner-1", inflight },
          extrahiereFn,
        );
        return {
          verarbeitet: true,
          auto_verbucht: ergebnis.status === "auto_verbucht",
          quelle: ergebnis.quelle,
        };
      },
    );

    let verarbeitet = 0;
    let auto = 0;
    let pruefung = 0;
    let viaKi = 0;
    for (const t of r.ergebnisse) {
      if (!t.verarbeitet) continue;
      verarbeitet++;
      if (t.auto_verbucht) auto++;
      else pruefung++;
      if (t.quelle === "ki") viaKi++;
    }

    expect(verarbeitet).toBe(30);
    expect(auto + pruefung).toBe(30);
    expect(auto).toBe(15);
    expect(pruefung).toBe(15);
    expect(viaKi).toBe(30);
  });
});
