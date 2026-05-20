import { describe, it, expect, vi } from "vitest";
import {
  entscheideBuchung,
  klassifiziereBuchung,
  ManuellBestaetigtError,
  DEFAULT_CONFIG,
  type BuchungFuerPipeline,
} from "./pipeline";
import {
  LlmKlassifiziererError,
  type LlmErgebnis,
  type KategorieOption,
} from "./llm";
import type { Lernregel } from "@/lib/types";

// PROJ-15: Factory liefert `empfaenger_normalisiert` immer mit (Default "")
// damit Tests den realen Pfad nach dem Import widerspiegeln. Tests, die
// Cache/Recherche bewusst auslösen wollen, setzen den Wert explizit.
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

function regel(p: Partial<Lernregel>): Lernregel {
  return {
    id: p.id ?? "r1",
    bezeichnung: "Regel",
    bedingung: p.bedingung ?? {},
    aktion: p.aktion ?? {},
    prioritaet: p.prioritaet ?? 100,
    aktiv: p.aktiv ?? true,
    treffer_zaehler: 0,
  };
}

const kategorien: KategorieOption[] = [
  { id: "kat-soft", bezeichnung: "Software", typ: "ausgabe" },
];

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

describe("entscheideBuchung — Regel-Vorrang", () => {
  it("Regeltreffer → auto_verbucht, quelle 'regel'", () => {
    const r = regel({
      bedingung: { empfaenger_muster: "test gmbh" },
      aktion: { kategorie_id: "kat-soft", klassifikation: "geschaeftlich" },
    });
    const { ergebnis } = entscheideBuchung(buchung(), [r], llmOk());
    expect(ergebnis.status).toBe("auto_verbucht");
    expect(ergebnis.quelle).toBe("regel");
    expect(ergebnis.regel_id).toBe("r1");
    expect(ergebnis.steuerrelevant).toBe(true);
  });

  it("privat-Regel setzt steuerrelevant=false", () => {
    const r = regel({
      bedingung: { empfaenger_muster: "test gmbh" },
      aktion: { klassifikation: "privat" },
    });
    const { ergebnis } = entscheideBuchung(buchung(), [r], null);
    expect(ergebnis.klassifikation).toBe("privat");
    expect(ergebnis.steuerrelevant).toBe(false);
    expect(ergebnis.status).toBe("auto_verbucht");
  });

  it("Regelkonflikt → zur_pruefung mit pruef_grund 'regelkonflikt'", () => {
    const a = regel({
      id: "a",
      bedingung: { empfaenger_muster: "test" },
      aktion: { klassifikation: "geschaeftlich" },
    });
    const b = regel({
      id: "b",
      bedingung: { zweck_muster: "test" },
      aktion: { klassifikation: "privat" },
    });
    const { ergebnis } = entscheideBuchung(buchung(), [a, b], null);
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toBe("regelkonflikt");
  });
});

describe("entscheideBuchung — Konfidenz & Ausreißer", () => {
  it("KI >= Schwellwert + Kategorie → auto_verbucht", () => {
    const { ergebnis } = entscheideBuchung(buchung(), [], llmOk());
    expect(ergebnis.status).toBe("auto_verbucht");
    expect(ergebnis.quelle).toBe("ki");
    expect(ergebnis.kategorie_id).toBe("kat-soft");
  });

  it("KI unter Schwellwert → zur_pruefung", () => {
    const { ergebnis } = entscheideBuchung(
      buchung(),
      [],
      llmOk({ konfidenz: 0.4 }),
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toContain("konfidenz_unter_schwellwert");
  });

  it("KI hohe Konfidenz aber keine Kategorie → zur_pruefung", () => {
    const { ergebnis } = entscheideBuchung(
      buchung(),
      [],
      llmOk({ kategorie_id: null }),
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toContain("keine_kategorie");
  });

  it("Fallback: privat ohne kategorie_id + Konfidenz≥Schwelle → Default-Privatentnahme, auto_verbucht", () => {
    const { ergebnis } = entscheideBuchung(
      buchung(),
      [],
      llmOk({
        klassifikation: "privat",
        kategorie_id: null,
        konfidenz: 0.95,
      }),
      {
        konfidenz_schwellwert: 0.85,
        betrag_limit: 2000,
        default_kategorie: { privat: "kat-privatentnahme" },
      },
    );
    expect(ergebnis.kategorie_id).toBe("kat-privatentnahme");
    expect(ergebnis.status).toBe("auto_verbucht");
    expect(ergebnis.pruef_grund).toBeNull();
  });

  it("Fallback: neutral ohne kategorie_id → Default-Geldtransit, auto_verbucht", () => {
    const { ergebnis } = entscheideBuchung(
      buchung(),
      [],
      llmOk({
        klassifikation: "neutral",
        kategorie_id: null,
        konfidenz: 0.95,
      }),
      {
        konfidenz_schwellwert: 0.85,
        betrag_limit: 2000,
        default_kategorie: { neutral: "kat-geldtransit" },
      },
    );
    expect(ergebnis.kategorie_id).toBe("kat-geldtransit");
    expect(ergebnis.status).toBe("auto_verbucht");
  });

  it("Fallback greift NICHT bei klassifikation='geschaeftlich' (zu spezifisch — soll in Prüfliste)", () => {
    const { ergebnis } = entscheideBuchung(
      buchung(),
      [],
      llmOk({
        klassifikation: "geschaeftlich",
        kategorie_id: null,
        konfidenz: 0.95,
      }),
      {
        konfidenz_schwellwert: 0.85,
        betrag_limit: 2000,
        default_kategorie: { privat: "kat-privatentnahme" },
      },
    );
    expect(ergebnis.kategorie_id).toBeNull();
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toContain("keine_kategorie");
  });

  it("Fallback greift NICHT bei niedriger Konfidenz", () => {
    const { ergebnis } = entscheideBuchung(
      buchung(),
      [],
      llmOk({
        klassifikation: "privat",
        kategorie_id: null,
        konfidenz: 0.7,
      }),
      {
        konfidenz_schwellwert: 0.85,
        betrag_limit: 2000,
        default_kategorie: { privat: "kat-privatentnahme" },
      },
    );
    expect(ergebnis.kategorie_id).toBeNull();
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toContain("konfidenz_unter_schwellwert");
  });

  it("klassifikation 'unklar' → zur_pruefung", () => {
    const { ergebnis } = entscheideBuchung(
      buchung(),
      [],
      llmOk({ klassifikation: "unklar" }),
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toContain("klassifikation_unklar");
  });

  it("Ausreißer-Betrag → zur_pruefung trotz hoher Konfidenz", () => {
    const { ergebnis } = entscheideBuchung(
      buchung({ betrag: -5000 }),
      [],
      llmOk(),
      DEFAULT_CONFIG,
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toContain("ausreisser_betrag");
  });

  it("Ausreißer auch bei Regeltreffer → zur_pruefung", () => {
    const r = regel({
      bedingung: { empfaenger_muster: "test" },
      aktion: { kategorie_id: "kat-soft", klassifikation: "geschaeftlich" },
    });
    const { ergebnis } = entscheideBuchung(
      buchung({ betrag: 9000 }),
      [r],
      null,
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toBe("ausreisser_betrag");
  });

  it("konfigurierbarer Schwellwert wird respektiert", () => {
    const { ergebnis } = entscheideBuchung(buchung(), [], llmOk({ konfidenz: 0.7 }), {
      konfidenz_schwellwert: 0.6,
      betrag_limit: 2000,
    });
    expect(ergebnis.status).toBe("auto_verbucht");
  });

  it("kein LLM-Ergebnis (Ausfall) → zur_pruefung, kein Datenverlust", () => {
    const { ergebnis, audit } = entscheideBuchung(buchung(), [], null);
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toBe("ki_nicht_verfuegbar");
    expect(audit.aktion).toBe("klassifiziert");
  });
});

describe("entscheideBuchung — Schutz manuell bestätigter Buchungen", () => {
  it("wirft ManuellBestaetigtError bei status 'manuell_bestaetigt'", () => {
    expect(() =>
      entscheideBuchung(
        buchung({ status: "manuell_bestaetigt" }),
        [],
        llmOk(),
      ),
    ).toThrow(ManuellBestaetigtError);
  });
});

describe("klassifiziereBuchung — Orchestrierung & LLM-Fallback", () => {
  it("ruft das LLM NICHT auf, wenn eine Regel greift", async () => {
    const llmFn = vi.fn();
    const r = regel({
      bedingung: { empfaenger_muster: "test gmbh" },
      aktion: { kategorie_id: "kat-soft", klassifikation: "geschaeftlich" },
    });
    const { ergebnis } = await klassifiziereBuchung(
      buchung(),
      [r],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
    );
    expect(llmFn).not.toHaveBeenCalled();
    expect(ergebnis.quelle).toBe("regel");
  });

  it("nutzt das LLM, wenn keine Regel greift", async () => {
    const llmFn = vi.fn().mockResolvedValue(llmOk());
    const { ergebnis } = await klassifiziereBuchung(
      buchung(),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
    );
    expect(llmFn).toHaveBeenCalledOnce();
    expect(ergebnis.quelle).toBe("ki");
    expect(ergebnis.status).toBe("auto_verbucht");
  });

  it("LLM-Ausfall → Fallback zur_pruefung (kein Raten)", async () => {
    const llmFn = vi
      .fn()
      .mockRejectedValue(new LlmKlassifiziererError("LLM down"));
    const { ergebnis } = await klassifiziereBuchung(
      buchung(),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
    );
    expect(ergebnis.status).toBe("zur_pruefung");
    expect(ergebnis.pruef_grund).toBe("ki_nicht_verfuegbar");
    expect(ergebnis.klassifikation).toBeNull();
  });

  it("unerwarteter Fehler im LLM wird durchgereicht", async () => {
    const llmFn = vi.fn().mockRejectedValue(new Error("Bug"));
    await expect(
      klassifiziereBuchung(
        buchung(),
        [],
        kategorien,
        DEFAULT_CONFIG,
        llmFn,
      ),
    ).rejects.toThrow("Bug");
  });

  it("überspringt manuell bestätigte Buchungen (wirft Error)", async () => {
    const llmFn = vi.fn();
    await expect(
      klassifiziereBuchung(
        buchung({ status: "manuell_bestaetigt" }),
        [],
        kategorien,
        DEFAULT_CONFIG,
        llmFn,
      ),
    ).rejects.toThrow(ManuellBestaetigtError);
    expect(llmFn).not.toHaveBeenCalled();
  });

  it("ohne PipelineKontext (kein Supabase) → KEIN Cache-Lookup, KEINE Recherche, einmaliger LLM-Aufruf", async () => {
    // Ab PROJ-15: Web-Recherche ist Cache-Fuell-Mechanismus, kein Pipeline-
    // Retry mehr. Ohne ctx.supabase + ctx.ownerId greift weder Cache noch
    // Recherche — LLM wird genau einmal aufgerufen.
    const llmFn = vi
      .fn()
      .mockResolvedValueOnce(
        llmOk({ konfidenz: 0.4, klassifikation: "unklar", kategorie_id: null }),
      );
    const rechercheFn = vi.fn();
    const { ergebnis } = await klassifiziereBuchung(
      buchung({ empfaenger: "Acme GmbH", empfaenger_normalisiert: "acme" }),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
      rechercheFn,
    );
    expect(rechercheFn).not.toHaveBeenCalled();
    expect(llmFn).toHaveBeenCalledOnce();
    expect(ergebnis.konfidenz).toBe(0.4);
  });
});

// ---------------------------------------------------------------------------
// PROJ-15: Cache-First-Pipeline mit Mock-Supabase
// ---------------------------------------------------------------------------

interface CacheRow {
  owner_id: string;
  empfaenger_norm: string;
  rohwert_beispiel: string | null;
  branche: string | null;
  leistung: string | null;
  web_snippets: Array<{ titel: string; beschreibung: string; url: string }> | null;
  letzte_klassifikation_default: unknown;
  quelle: "web" | "manuell" | "llm";
  recherche_versucht: boolean;
  cached_at: string;
  ttl_tage: number;
  updated_at: string;
}

/**
 * Minimaler Supabase-Mock fuer Pipeline-Tests:
 *  - empfaenger_kenntnis: in-memory Map
 *  - audit_eintrag: ignoriert (best-effort)
 *  - buchung: liefert konfigurierbares Historie-Result
 */
function makePipelineSupabase(opts: {
  cache?: CacheRow[];
  historieRows?: Array<{
    betrag: number;
    kategorie_id: string | null;
    klassifikation: string | null;
  }>;
}) {
  const cache = new Map<string, CacheRow>();
  for (const c of opts.cache ?? []) {
    cache.set(`${c.owner_id}::${c.empfaenger_norm}`, c);
  }

  const upsertSpy = vi.fn();
  const updateSpy = vi.fn();
  const insertSpy = vi.fn();
  const historieResult = {
    data: opts.historieRows ?? null,
    error: null,
  };

  function buildKenntnisChain() {
    const filter: { owner_id?: string; empfaenger_norm?: string } = {};
    const chain: {
      eq: (col: string, val: string) => typeof chain;
      maybeSingle: () => Promise<{ data: CacheRow | null; error: null }>;
    } = {
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

  function buildBuchungChain() {
    return {
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(historieResult),
    };
  }

  const from = vi.fn((tabelle: string) => {
    if (tabelle === "empfaenger_kenntnis") {
      return {
        select: vi.fn(() => buildKenntnisChain()),
        upsert: vi.fn(async (row: CacheRow) => {
          upsertSpy(row);
          cache.set(`${row.owner_id}::${row.empfaenger_norm}`, {
            ...row,
            updated_at: new Date().toISOString(),
          });
          return { error: null };
        }),
        // PROJ-15-Bugfix: UPDATE auf nur ein Feld (aktualisiere
        // LetzteKlassifikation). Wir filtern owner_id + empfaenger_norm und
        // wenden das Patch auf den bestehenden Cache-Eintrag an.
        update: vi.fn((patch: Partial<CacheRow>) => {
          const filter: { owner_id?: string; empfaenger_norm?: string } = {};
          const updateChain: {
            eq: (col: string, val: string) => unknown;
          } = {
            eq: function (col: string, val: string) {
              if (col === "owner_id") filter.owner_id = val;
              if (col === "empfaenger_norm") {
                filter.empfaenger_norm = val;
                const key = `${filter.owner_id ?? ""}::${filter.empfaenger_norm ?? ""}`;
                const existing = cache.get(key);
                if (existing) {
                  const merged: CacheRow = {
                    ...existing,
                    ...patch,
                    updated_at: new Date().toISOString(),
                  };
                  cache.set(key, merged);
                  updateSpy({ filter: { ...filter }, patch });
                }
                return Promise.resolve({ error: null });
              }
              return updateChain;
            },
          };
          return updateChain;
        }),
        insert: vi.fn(async () => ({ error: null })),
      };
    }
    if (tabelle === "buchung") {
      return {
        select: vi.fn(() => buildBuchungChain()),
      };
    }
    if (tabelle === "audit_eintrag") {
      return {
        select: vi.fn(),
        insert: vi.fn(async (row: unknown) => {
          insertSpy(row);
          return { error: null };
        }),
      };
    }
    throw new Error(`Unerwartete Tabelle im Mock: ${tabelle}`);
  });

  return { from, cache, upsertSpy, updateSpy, insertSpy };
}

describe("klassifiziereBuchung — PROJ-15 Cache-First", () => {
  it("Cache-Miss + Recherche-Kandidat → Firecrawl-Call, Cache-Upsert, EIN LLM-Aufruf", async () => {
    const { from, upsertSpy } = makePipelineSupabase({ cache: [] });
    // Mock-Supabase als minimaler Client. Pipeline ruft nur from() auf.
    const supabase = { from } as never;

    const llmFn = vi.fn().mockResolvedValue(
      llmOk({ klassifikation: "geschaeftlich", konfidenz: 0.92 }),
    );
    const rechercheFn = vi.fn().mockResolvedValue({
      query: "Acme GmbH Deutschland",
      treffer: [
        { titel: "Acme GmbH", beschreibung: "Software-Anbieter.", url: "https://acme.example" },
      ],
    });
    const extrahiereFn = vi
      .fn()
      .mockResolvedValue({ branche: "Software", leistung: "SaaS-Anbieter." });

    const { audit } = await klassifiziereBuchung(
      buchung({ empfaenger: "Acme GmbH", empfaenger_normalisiert: "acme" }),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
      rechercheFn,
      { supabase, ownerId: "owner-1" },
      extrahiereFn,
    );

    expect(rechercheFn).toHaveBeenCalledOnce();
    // Genau EIN LLM-Call — kein Retry-Schema mehr.
    expect(llmFn).toHaveBeenCalledOnce();
    // Branche/Leistung-Extraktion wurde aufgerufen.
    expect(extrahiereFn).toHaveBeenCalledOnce();
    // Initialer Web-Upsert enthaelt Branche + Leistung.
    const webUpserts = upsertSpy.mock.calls.filter(
      (c: unknown[]) => (c[0] as { quelle: string }).quelle === "web",
    );
    expect(webUpserts.length).toBeGreaterThanOrEqual(1);
    expect(webUpserts[0][0]).toMatchObject({
      quelle: "web",
      branche: "Software",
      leistung: "SaaS-Anbieter.",
    });
    expect(audit.details.web_recherche).toMatchObject({ genutzt: true });
    expect(audit.details.empfaenger_kenntnis).toBeDefined();
  });

  it("Cache-Hit (nicht abgelaufen) → KEINE Recherche, EIN LLM-Aufruf mit Kontext", async () => {
    const { from } = makePipelineSupabase({
      cache: [
        {
          owner_id: "owner-1",
          empfaenger_norm: "acme",
          rohwert_beispiel: "Acme GmbH",
          branche: "Software",
          leistung: "Cloud-Hosting",
          web_snippets: [
            { titel: "Acme", beschreibung: "Cloud.", url: "https://acme.example" },
          ],
          letzte_klassifikation_default: null,
          quelle: "web",
          recherche_versucht: true,
          cached_at: new Date().toISOString(),
          ttl_tage: 180,
          updated_at: new Date().toISOString(),
        },
      ],
    });
    // Mock-Supabase als minimaler Client. Pipeline ruft nur from() auf.
    const supabase = { from } as never;

    const llmFn = vi.fn().mockResolvedValue(llmOk());
    const rechercheFn = vi.fn();

    await klassifiziereBuchung(
      buchung({ empfaenger: "Acme GmbH", empfaenger_normalisiert: "acme" }),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
      rechercheFn,
      { supabase, ownerId: "owner-1" },
    );

    expect(rechercheFn).not.toHaveBeenCalled();
    expect(llmFn).toHaveBeenCalledOnce();
    // LLM bekommt Kenntnis-Block mit.
    const llmEingabe = llmFn.mock.calls[0][0] as { empfaenger_kenntnis?: unknown };
    expect(llmEingabe.empfaenger_kenntnis).not.toBeNull();
  });

  it("Privatperson 'Max Mustermann' → KEINE Recherche (DSGVO)", async () => {
    const { from } = makePipelineSupabase({ cache: [] });
    // Mock-Supabase als minimaler Client. Pipeline ruft nur from() auf.
    const supabase = { from } as never;

    const llmFn = vi.fn().mockResolvedValue(
      llmOk({ klassifikation: "privat", konfidenz: 0.6, kategorie_id: null }),
    );
    const rechercheFn = vi.fn();

    await klassifiziereBuchung(
      buchung({
        empfaenger: "Max Mustermann",
        empfaenger_normalisiert: "max mustermann",
      }),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
      rechercheFn,
      { supabase, ownerId: "owner-1" },
    );

    expect(rechercheFn).not.toHaveBeenCalled();
    expect(llmFn).toHaveBeenCalledOnce();
  });

  it("Inflight-Map: zwei parallele Buchungen mit gleichem Empfaenger → EIN Firecrawl-Call", async () => {
    const { from } = makePipelineSupabase({ cache: [] });
    // Mock-Supabase als minimaler Client. Pipeline ruft nur from() auf.
    const supabase = { from } as never;

    // Recherche bewusst mit Delay, damit beide Tasks im Inflight-Status sind.
    const rechercheFn = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                query: "Acme GmbH Deutschland",
                treffer: [
                  {
                    titel: "Acme GmbH",
                    beschreibung: "Software.",
                    url: "https://acme.example",
                  },
                ],
              }),
            20,
          ),
        ),
    );
    const llmFn = vi.fn().mockResolvedValue(llmOk({ konfidenz: 0.92 }));
    const extrahiereFn = vi
      .fn()
      .mockResolvedValue({ branche: "Software", leistung: "SaaS." });

    const inflight = new Map<string, Promise<unknown>>() as never;

    const [a, b] = await Promise.all([
      klassifiziereBuchung(
        buchung({
          id: "b1",
          empfaenger: "Acme GmbH",
          empfaenger_normalisiert: "acme",
        }),
        [],
        kategorien,
        DEFAULT_CONFIG,
        llmFn,
        rechercheFn,
        { supabase, ownerId: "owner-1", inflight },
        extrahiereFn,
      ),
      klassifiziereBuchung(
        buchung({
          id: "b2",
          empfaenger: "Acme GmbH",
          empfaenger_normalisiert: "acme",
        }),
        [],
        kategorien,
        DEFAULT_CONFIG,
        llmFn,
        rechercheFn,
        { supabase, ownerId: "owner-1", inflight },
        extrahiereFn,
      ),
    ]);

    expect(rechercheFn).toHaveBeenCalledOnce();
    // Auch die Extraktion wird nur EINMAL pro Empfaenger ausgeloest, weil
    // die Inflight-Map den gesamten recherchiereUndUpserte-Aufruf bundlet.
    expect(extrahiereFn).toHaveBeenCalledOnce();
    expect(a.ergebnis.status).toBe("auto_verbucht");
    expect(b.ergebnis.status).toBe("auto_verbucht");
  });

  it("Web-Recherche abgeschaltet → kein Firecrawl-Call, Kenntnis bleibt leer", async () => {
    const { from } = makePipelineSupabase({ cache: [] });
    // Mock-Supabase als minimaler Client. Pipeline ruft nur from() auf.
    const supabase = { from } as never;

    const llmFn = vi.fn().mockResolvedValue(llmOk());
    const rechercheFn = vi.fn();

    await klassifiziereBuchung(
      buchung({ empfaenger: "Acme GmbH", empfaenger_normalisiert: "acme" }),
      [],
      kategorien,
      { ...DEFAULT_CONFIG, web_recherche_aktiv: false },
      llmFn,
      rechercheFn,
      { supabase, ownerId: "owner-1" },
    );

    expect(rechercheFn).not.toHaveBeenCalled();
    expect(llmFn).toHaveBeenCalledOnce();
  });

  it("Cache leer + hohe LLM-Konfidenz → Web-Recherche schreibt 'web', LLM-Upsert hebt letzte Klassifikation per UPDATE nach (quelle bleibt 'web')", async () => {
    // PROJ-15-Bugfix: Wenn schon ein Web-Eintrag existiert (auch ein leerer
    // Cooldown-Eintrag aus dem Recherche-Versuch), darf der LLM-Konfidenz-
    // Pfad die quelle NICHT auf 'llm' kippen. Stattdessen wird nur
    // `letzte_klassifikation_default` per UPDATE nachgezogen.
    const { from, upsertSpy, updateSpy } = makePipelineSupabase({ cache: [] });
    const supabase = { from } as never;

    const llmFn = vi.fn().mockResolvedValue(
      llmOk({ klassifikation: "geschaeftlich", konfidenz: 0.95 }),
    );
    // Recherche liefert nichts — schreibt aber dennoch einen Cooldown-Eintrag
    // mit quelle='web' (recherche_versucht=true, snippets=null).
    const rechercheFn = vi.fn().mockResolvedValue(null);
    const extrahiereFn = vi.fn(); // wird nicht aufgerufen, weil snippets null

    await klassifiziereBuchung(
      buchung({ empfaenger: "Acme GmbH", empfaenger_normalisiert: "acme" }),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
      rechercheFn,
      { supabase, ownerId: "owner-1" },
      extrahiereFn,
    );

    expect(extrahiereFn).not.toHaveBeenCalled();

    // Es darf KEINEN Upsert mit quelle='llm' geben — der Web-Eintrag muss
    // erhalten bleiben.
    const llmUpserts = upsertSpy.mock.calls.filter(
      (c: unknown[]) => (c[0] as { quelle: string }).quelle === "llm",
    );
    expect(llmUpserts).toHaveLength(0);

    // Stattdessen wurde per UPDATE nur letzte_klassifikation_default gesetzt.
    const updateCalls = updateSpy.mock.calls.filter(
      (c: unknown[]) =>
        Object.prototype.hasOwnProperty.call(
          (c[0] as { patch: Record<string, unknown> }).patch,
          "letzte_klassifikation_default",
        ),
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
    const patch = (updateCalls[0][0] as {
      patch: { letzte_klassifikation_default: { konfidenz: number } };
    }).patch;
    expect(patch.letzte_klassifikation_default.konfidenz).toBe(0.95);
  });

  it("Cache leer ohne Recherche-Kandidat + hohe LLM-Konfidenz → Upsert mit quelle='llm', alle Felder neu", async () => {
    // Ohne Recherche-Kandidat (z. B. nur 2 Wortteile + keine Rechtsform):
    // Der LLM-Konfidenz-Pfad greift gar nicht, weil `kandidat=false`.
    // Daher KEIN Upsert. Stattdessen testen wir hier den Pfad
    // `kenntnis === null` mit Recherche-Kandidat aber abgeschalteter
    // Web-Recherche.
    const { from, upsertSpy } = makePipelineSupabase({ cache: [] });
    const supabase = { from } as never;

    const llmFn = vi.fn().mockResolvedValue(
      llmOk({ klassifikation: "geschaeftlich", konfidenz: 0.95 }),
    );
    const rechercheFn = vi.fn();

    await klassifiziereBuchung(
      buchung({ empfaenger: "Acme GmbH", empfaenger_normalisiert: "acme" }),
      [],
      kategorien,
      { ...DEFAULT_CONFIG, web_recherche_aktiv: false },
      llmFn,
      rechercheFn,
      { supabase, ownerId: "owner-1" },
    );

    expect(rechercheFn).not.toHaveBeenCalled();
    // Genau ein Upsert mit quelle='llm', branche/leistung/snippets null.
    const llmUpserts = upsertSpy.mock.calls.filter(
      (c: unknown[]) => (c[0] as { quelle: string }).quelle === "llm",
    );
    expect(llmUpserts.length).toBe(1);
    const upsert = llmUpserts[0][0] as {
      branche: string | null;
      leistung: string | null;
      web_snippets: unknown;
      letzte_klassifikation_default: { konfidenz: number };
    };
    expect(upsert.branche).toBeNull();
    expect(upsert.leistung).toBeNull();
    expect(upsert.web_snippets).toBeNull();
    expect(upsert.letzte_klassifikation_default.konfidenz).toBe(0.95);
  });

  it("Cache 'web' vorhanden + hohe LLM-Konfidenz → quelle bleibt 'web', branche/leistung/snippets unveraendert, nur letzte_klassifikation_default neu", async () => {
    const initialSnippets = [
      { titel: "Acme", beschreibung: "Cloud.", url: "https://acme.example" },
    ];
    const { from, upsertSpy, updateSpy, cache } = makePipelineSupabase({
      cache: [
        {
          owner_id: "owner-1",
          empfaenger_norm: "acme",
          rohwert_beispiel: "Acme GmbH",
          branche: "Software",
          leistung: "Cloud-Hosting",
          web_snippets: initialSnippets,
          letzte_klassifikation_default: null,
          quelle: "web",
          recherche_versucht: true,
          cached_at: new Date().toISOString(),
          ttl_tage: 180,
          updated_at: new Date().toISOString(),
        },
      ],
    });
    const supabase = { from } as never;

    const llmFn = vi.fn().mockResolvedValue(
      llmOk({ klassifikation: "geschaeftlich", konfidenz: 0.95 }),
    );
    const rechercheFn = vi.fn();

    await klassifiziereBuchung(
      buchung({ empfaenger: "Acme GmbH", empfaenger_normalisiert: "acme" }),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
      rechercheFn,
      { supabase, ownerId: "owner-1" },
    );

    // Keine Web-Recherche (Cache-Hit).
    expect(rechercheFn).not.toHaveBeenCalled();
    // Kein quelle='llm'-Upsert.
    const llmUpserts = upsertSpy.mock.calls.filter(
      (c: unknown[]) => (c[0] as { quelle: string }).quelle === "llm",
    );
    expect(llmUpserts).toHaveLength(0);

    // UPDATE wurde aufgerufen, nur mit letzte_klassifikation_default.
    expect(updateSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    const lastCall = updateSpy.mock.calls[updateSpy.mock.calls.length - 1];
    expect((lastCall[0] as { patch: Record<string, unknown> }).patch).toEqual({
      letzte_klassifikation_default: {
        klassifikation: "geschaeftlich",
        steuerrelevant: true,
        kategorie_id: "kat-soft",
        ust_satz: 19,
        konfidenz: 0.95,
      },
    });

    // Cache-Eintrag bleibt 'web' mit unveraenderter Branche/Leistung/Snippets.
    const stored = cache.get("owner-1::acme");
    expect(stored?.quelle).toBe("web");
    expect(stored?.branche).toBe("Software");
    expect(stored?.leistung).toBe("Cloud-Hosting");
    expect(stored?.web_snippets).toEqual(initialSnippets);
  });

  it("manuelle Kenntnis wird NICHT vom LLM-Upsert ueberschrieben", async () => {
    const { from, upsertSpy } = makePipelineSupabase({
      cache: [
        {
          owner_id: "owner-1",
          empfaenger_norm: "acme",
          rohwert_beispiel: "Acme GmbH",
          branche: "Steuerberatung",
          leistung: "Beratung",
          web_snippets: null,
          letzte_klassifikation_default: null,
          quelle: "manuell",
          recherche_versucht: false,
          cached_at: new Date().toISOString(),
          ttl_tage: 36500,
          updated_at: new Date().toISOString(),
        },
      ],
    });
    // Mock-Supabase als minimaler Client. Pipeline ruft nur from() auf.
    const supabase = { from } as never;

    const llmFn = vi.fn().mockResolvedValue(
      llmOk({ klassifikation: "geschaeftlich", konfidenz: 0.95 }),
    );
    const rechercheFn = vi.fn();

    await klassifiziereBuchung(
      buchung({ empfaenger: "Acme GmbH", empfaenger_normalisiert: "acme" }),
      [],
      kategorien,
      DEFAULT_CONFIG,
      llmFn,
      rechercheFn,
      { supabase, ownerId: "owner-1" },
    );

    expect(rechercheFn).not.toHaveBeenCalled();
    // Kein LLM-Upsert, weil die Kenntnis manuell ist.
    const llmUpserts = upsertSpy.mock.calls.filter(
      (c: unknown[]) => (c[0] as { quelle: string }).quelle === "llm",
    );
    expect(llmUpserts).toHaveLength(0);
  });
});
