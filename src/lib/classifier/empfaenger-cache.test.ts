import { describe, expect, it, vi } from "vitest";
import {
  aktualisiereLetzteKlassifikation,
  defaultTtl,
  holeKenntnis,
  istAbgelaufen,
  istRechercheKandidat,
  neueInflightMap,
  upsertKenntnis,
  type EmpfaengerKenntnis,
} from "./empfaenger-cache";

// ---------------------------------------------------------------------------
// Mock-Builder fuer Supabase Query-Chains
// ---------------------------------------------------------------------------

interface QueryStub {
  data: unknown;
  error: unknown;
}

/**
 * Baut einen minimalen Supabase-Mock, der ausschliesslich die Methoden
 * unterstuetzt, die wir hier brauchen:
 *  - .from(tabelle).select(...).eq(...).eq(...).maybeSingle() -> data|null
 *  - .from(tabelle).upsert(row, opts) -> {error}
 *  - .from(tabelle).insert(row).then(...)  // best-effort audit
 */
function makeSupabase(opts: {
  selectResult?: QueryStub;
  upsertResult?: QueryStub;
  insertResult?: QueryStub;
}) {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue(opts.selectResult ?? { data: null, error: null }),
  };

  const upsertResult = opts.upsertResult ?? { data: null, error: null };
  const insertResult = opts.insertResult ?? { data: null, error: null };

  const from = vi.fn(() => ({
    select: vi.fn(() => selectChain),
    upsert: vi.fn().mockResolvedValue(upsertResult),
    insert: vi.fn().mockResolvedValue(insertResult),
  }));

  return { from, selectChain };
}

function kenntnisFixture(over: Partial<EmpfaengerKenntnis> = {}): EmpfaengerKenntnis {
  return {
    owner_id: "owner-1",
    empfaenger_norm: "acme",
    rohwert_beispiel: "Acme GmbH",
    branche: null,
    leistung: null,
    web_snippets: null,
    letzte_klassifikation_default: null,
    quelle: "web",
    recherche_versucht: true,
    cached_at: "2026-01-01T00:00:00.000Z",
    ttl_tage: 180,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

// ---------------------------------------------------------------------------
// istAbgelaufen
// ---------------------------------------------------------------------------

describe("istAbgelaufen", () => {
  it("cached_at = jetzt → nicht abgelaufen", () => {
    const k = kenntnisFixture({ cached_at: "2026-05-20T12:00:00.000Z" });
    expect(istAbgelaufen(k, new Date("2026-05-20T12:00:00.000Z"))).toBe(false);
  });

  it("innerhalb der TTL (genau ttl-1 Tag) → nicht abgelaufen", () => {
    const k = kenntnisFixture({
      cached_at: "2026-05-01T00:00:00.000Z",
      ttl_tage: 10,
    });
    // cached_at + 9 Tage
    const jetzt = new Date("2026-05-10T00:00:00.000Z");
    expect(istAbgelaufen(k, jetzt)).toBe(false);
  });

  it("genau am Ablauftag (cached_at + ttl) → noch nicht abgelaufen", () => {
    const k = kenntnisFixture({
      cached_at: "2026-05-01T00:00:00.000Z",
      ttl_tage: 10,
    });
    const jetzt = new Date("2026-05-11T00:00:00.000Z");
    expect(istAbgelaufen(k, jetzt)).toBe(false);
  });

  it("einen Tag nach dem Ablauf → abgelaufen", () => {
    const k = kenntnisFixture({
      cached_at: "2026-05-01T00:00:00.000Z",
      ttl_tage: 10,
    });
    const jetzt = new Date("2026-05-12T00:00:00.000Z");
    expect(istAbgelaufen(k, jetzt)).toBe(true);
  });

  it("ttl_tage=0 → genau am cached_at noch gueltig, danach abgelaufen", () => {
    const k = kenntnisFixture({
      cached_at: "2026-05-01T00:00:00.000Z",
      ttl_tage: 0,
    });
    // Identischer Zeitpunkt → noch gueltig (Grenze = cached_at + 0).
    expect(istAbgelaufen(k, new Date("2026-05-01T00:00:00.000Z"))).toBe(false);
    // Ein Tick spaeter → abgelaufen.
    expect(istAbgelaufen(k, new Date("2026-05-01T00:00:00.001Z"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// istRechercheKandidat — DSGVO-Gate
// ---------------------------------------------------------------------------

describe("istRechercheKandidat", () => {
  it("leerer Name → kein Kandidat", () => {
    expect(istRechercheKandidat("", "")).toBe(false);
    expect(istRechercheKandidat(null, null)).toBe(false);
    expect(istRechercheKandidat(undefined, undefined)).toBe(false);
  });

  it("Privatperson 'Max Mustermann' (2 Wortteile, keine Rechtsform) → kein Kandidat", () => {
    expect(istRechercheKandidat("Max Mustermann", "max mustermann")).toBe(false);
  });

  it("Firma mit Rechtsform GmbH → Kandidat", () => {
    expect(istRechercheKandidat("Acme GmbH", "acme")).toBe(true);
  });

  it("Firma mit Rechtsform Ltd. → Kandidat", () => {
    expect(istRechercheKandidat("Acme Ltd.", "acme")).toBe(true);
  });

  it("Firma mit Rechtsform Inc. → Kandidat", () => {
    expect(istRechercheKandidat("Some Company Inc.", "some company")).toBe(true);
  });

  it("Empfaenger mit 3 Wortteilen ohne Rechtsform → Kandidat", () => {
    expect(
      istRechercheKandidat("Berlin Tech Solutions", "berlin tech solutions"),
    ).toBe(true);
  });

  it("Empfaenger mit 2 Wortteilen ohne Rechtsform → kein Kandidat", () => {
    expect(istRechercheKandidat("Acme Solutions", "acme solutions")).toBe(false);
  });

  it("Einzelner Wortteil ohne Rechtsform → kein Kandidat", () => {
    expect(istRechercheKandidat("Stripe", "stripe")).toBe(false);
  });

  it("Rechtsform mit Klammern 'GmbH & Co. KG' → Kandidat", () => {
    expect(
      istRechercheKandidat("Mueller GmbH & Co. KG", "mueller"),
    ).toBe(true);
  });

  it("Rechtsform in Mitte des Namens an Wortgrenze → Kandidat", () => {
    expect(istRechercheKandidat("Acme Ltd Berlin", "acme berlin")).toBe(true);
  });

  it("'AG' eingebettet in 'Agentur' → KEIN Kandidat (Wortgrenze schuetzt)", () => {
    // 1 Wortteil, kein eigenstaendiges Rechtsform-Token
    expect(istRechercheKandidat("Agentur", "agentur")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// defaultTtl
// ---------------------------------------------------------------------------

describe("defaultTtl", () => {
  it("manuell → faktisch unbegrenzt", () => {
    expect(defaultTtl("manuell")).toBeGreaterThanOrEqual(36500);
  });
  it("web → 180 Tage", () => {
    expect(defaultTtl("web")).toBe(180);
  });
  it("llm → 30 Tage (kuerzer, weil potenziell falsch)", () => {
    expect(defaultTtl("llm")).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// holeKenntnis (Supabase-Mock)
// ---------------------------------------------------------------------------

describe("holeKenntnis", () => {
  it("liefert null bei leerem empfaenger_norm (kein DB-Call)", async () => {
    const { from } = makeSupabase({});
    const res = await holeKenntnis(
      { from } as unknown as Parameters<typeof holeKenntnis>[0],
      "owner-1",
      "   ",
    );
    expect(res).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("liefert null bei DB-Fehler", async () => {
    const { from } = makeSupabase({
      selectResult: { data: null, error: { message: "RLS" } },
    });
    const res = await holeKenntnis(
      { from } as unknown as Parameters<typeof holeKenntnis>[0],
      "owner-1",
      "acme",
    );
    expect(res).toBeNull();
  });

  it("liefert den Eintrag bei Treffer", async () => {
    const fixture = kenntnisFixture();
    const { from, selectChain } = makeSupabase({
      selectResult: { data: fixture, error: null },
    });
    const res = await holeKenntnis(
      { from } as unknown as Parameters<typeof holeKenntnis>[0],
      "owner-1",
      "acme",
    );
    expect(res).toEqual(fixture);
    expect(from).toHaveBeenCalledWith("empfaenger_kenntnis");
    expect(selectChain.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(selectChain.eq).toHaveBeenCalledWith("empfaenger_norm", "acme");
  });
});

// ---------------------------------------------------------------------------
// upsertKenntnis
// ---------------------------------------------------------------------------

describe("upsertKenntnis", () => {
  it("ueberspringt leeren empfaenger_norm", async () => {
    const { from } = makeSupabase({});
    await upsertKenntnis(
      { from } as unknown as Parameters<typeof upsertKenntnis>[0],
      {
        owner_id: "owner-1",
        empfaenger_norm: "   ",
        quelle: "web",
      },
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("schreibt Upsert mit Default-TTL je Quelle", async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    const insertSpy = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({
      select: vi.fn(),
      upsert: upsertSpy,
      insert: insertSpy,
    }));

    await upsertKenntnis(
      { from } as unknown as Parameters<typeof upsertKenntnis>[0],
      {
        owner_id: "owner-1",
        empfaenger_norm: "acme",
        quelle: "llm",
        branche: "Software",
      },
    );
    expect(upsertSpy).toHaveBeenCalledOnce();
    const [row, opts] = upsertSpy.mock.calls[0];
    expect(row).toMatchObject({
      owner_id: "owner-1",
      empfaenger_norm: "acme",
      quelle: "llm",
      branche: "Software",
      ttl_tage: 30, // LLM-Default
    });
    expect(opts).toEqual({ onConflict: "owner_id,empfaenger_norm" });
  });

  it("manuelle Quelle bekommt langen TTL-Default", async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    const insertSpy = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({
      select: vi.fn(),
      upsert: upsertSpy,
      insert: insertSpy,
    }));

    await upsertKenntnis(
      { from } as unknown as Parameters<typeof upsertKenntnis>[0],
      {
        owner_id: "owner-1",
        empfaenger_norm: "acme",
        quelle: "manuell",
      },
    );
    const [row] = upsertSpy.mock.calls[0];
    expect(row.ttl_tage).toBeGreaterThanOrEqual(36500);
  });

  it("schreibt Audit-Eintrag in audit_eintrag mit aktion 'kenntnis_aktualisiert'", async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    const insertSpy = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({
      select: vi.fn(),
      upsert: upsertSpy,
      insert: insertSpy,
    }));

    await upsertKenntnis(
      { from } as unknown as Parameters<typeof upsertKenntnis>[0],
      {
        owner_id: "owner-1",
        empfaenger_norm: "acme",
        quelle: "web",
        branche: "Software",
        leistung: "Cloud-Services",
      },
    );
    expect(from).toHaveBeenCalledWith("audit_eintrag");
    expect(insertSpy).toHaveBeenCalledOnce();
    const [row] = insertSpy.mock.calls[0];
    expect(row).toMatchObject({
      owner_id: "owner-1",
      entitaet: "empfaenger_kenntnis",
      aktion: "kenntnis_aktualisiert",
      quelle: "web",
    });
    expect((row as { details: Record<string, unknown> }).details).toMatchObject(
      {
        empfaenger_norm: "acme",
        branche: "Software",
        leistung: "Cloud-Services",
      },
    );
  });

  it("schreibt keinen Audit-Eintrag, wenn Upsert fehlschlaegt", async () => {
    const upsertSpy = vi
      .fn()
      .mockResolvedValue({ error: { message: "boom" } });
    const insertSpy = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({
      select: vi.fn(),
      upsert: upsertSpy,
      insert: insertSpy,
    }));

    await upsertKenntnis(
      { from } as unknown as Parameters<typeof upsertKenntnis>[0],
      {
        owner_id: "owner-1",
        empfaenger_norm: "acme",
        quelle: "web",
      },
    );
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// aktualisiereLetzteKlassifikation (PROJ-15-Bugfix)
// ---------------------------------------------------------------------------

describe("aktualisiereLetzteKlassifikation", () => {
  it("ueberspringt leeren empfaenger_norm (kein DB-Call)", async () => {
    const from = vi.fn();
    await aktualisiereLetzteKlassifikation(
      { from } as unknown as Parameters<typeof aktualisiereLetzteKlassifikation>[0],
      "owner-1",
      "   ",
      {
        klassifikation: "geschaeftlich",
        steuerrelevant: true,
        kategorie_id: "kat-soft",
        ust_satz: 19,
        konfidenz: 0.95,
      },
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("schreibt UPDATE auf empfaenger_kenntnis mit korrekten Filtern", async () => {
    const eqSpy = vi.fn().mockReturnThis();
    const chain = {
      eq: eqSpy,
    };
    // Letzter .eq() Aufruf liefert eine Promise — Supabase JS gibt thenable
    // Builder zurueck; wir simulieren das schlicht ueber Promise.resolve am
    // letzten eq-Call. `_val` ungenutzt, weil das Test-Mock den konkreten
    // Wert nicht prueft, sondern nur die Spaltenreihenfolge.
    chain.eq = vi.fn((col: string, _val: string) => {
      if (col === "empfaenger_norm") {
        return Promise.resolve({ error: null });
      }
      return chain;
    }) as never;

    const updateSpy = vi.fn(() => chain);
    const from = vi.fn(() => ({ update: updateSpy }));

    const klass = {
      klassifikation: "geschaeftlich" as const,
      steuerrelevant: true,
      kategorie_id: "kat-soft",
      ust_satz: 19 as const,
      konfidenz: 0.95,
    };
    await aktualisiereLetzteKlassifikation(
      { from } as unknown as Parameters<typeof aktualisiereLetzteKlassifikation>[0],
      "owner-1",
      "acme",
      klass,
    );

    expect(from).toHaveBeenCalledWith("empfaenger_kenntnis");
    expect(updateSpy).toHaveBeenCalledWith({
      letzte_klassifikation_default: klass,
    });
  });

  it("propagiert keine DB-Fehler (best-effort)", async () => {
    const finalEq = vi
      .fn()
      .mockResolvedValue({ error: { message: "RLS" } });
    const chain = {
      eq: vi.fn(function (this: unknown, col: string) {
        if (col === "empfaenger_norm") return finalEq();
        return chain;
      }),
    };
    const updateSpy = vi.fn(() => chain);
    const from = vi.fn(() => ({ update: updateSpy }));

    await expect(
      aktualisiereLetzteKlassifikation(
        { from } as unknown as Parameters<
          typeof aktualisiereLetzteKlassifikation
        >[0],
        "owner-1",
        "acme",
        {
          klassifikation: "geschaeftlich",
          steuerrelevant: true,
          kategorie_id: null,
          ust_satz: null,
          konfidenz: 0.9,
        },
      ),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// neueInflightMap
// ---------------------------------------------------------------------------

describe("neueInflightMap", () => {
  it("erzeugt eine leere Map, die unabhaengig pro Aufruf ist", () => {
    const a = neueInflightMap();
    const b = neueInflightMap();
    a.set("x", Promise.resolve(null));
    expect(b.size).toBe(0);
    expect(a.size).toBe(1);
  });
});
