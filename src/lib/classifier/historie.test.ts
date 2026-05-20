import { describe, expect, it, vi } from "vitest";
import {
  aggregiere,
  holeAehnlicheBuchungen,
} from "./historie";

// ---------------------------------------------------------------------------
// aggregiere (pure)
// ---------------------------------------------------------------------------

describe("aggregiere", () => {
  it("ein Treffer", () => {
    const a = aggregiere([
      { betrag: -19.99, kategorie_id: "k1", klassifikation: "geschaeftlich" },
    ]);
    expect(a.anzahl).toBe(1);
    expect(a.betrag_min).toBe(-19.99);
    expect(a.betrag_max).toBe(-19.99);
    expect(a.betrag_median).toBe(-19.99);
    expect(a.haeufigste_kategorie_id).toBe("k1");
    expect(a.haeufigste_kategorie_anzahl).toBe(1);
    expect(a.haeufigste_klassifikation).toBe("geschaeftlich");
  });

  it("Median bei ungerader Anzahl (3 Werte)", () => {
    const a = aggregiere([
      { betrag: -10, kategorie_id: "k1", klassifikation: "geschaeftlich" },
      { betrag: -30, kategorie_id: "k1", klassifikation: "geschaeftlich" },
      { betrag: -20, kategorie_id: "k1", klassifikation: "geschaeftlich" },
    ]);
    expect(a.betrag_median).toBe(-20);
    expect(a.betrag_min).toBe(-30);
    expect(a.betrag_max).toBe(-10);
  });

  it("Median bei gerader Anzahl (4 Werte) = Mittel der zwei Mittelwerte", () => {
    const a = aggregiere([
      { betrag: -10, kategorie_id: "k1", klassifikation: "geschaeftlich" },
      { betrag: -20, kategorie_id: "k1", klassifikation: "geschaeftlich" },
      { betrag: -30, kategorie_id: "k1", klassifikation: "geschaeftlich" },
      { betrag: -40, kategorie_id: "k1", klassifikation: "geschaeftlich" },
    ]);
    // sortiert: -40, -30, -20, -10 -> Median = (-30 + -20) / 2 = -25
    expect(a.betrag_median).toBe(-25);
  });

  it("haeufigste Kategorie bei gemischten Kategorien (5 Treffer)", () => {
    const a = aggregiere([
      { betrag: -10, kategorie_id: "k1", klassifikation: "geschaeftlich" },
      { betrag: -20, kategorie_id: "k1", klassifikation: "geschaeftlich" },
      { betrag: -30, kategorie_id: "k1", klassifikation: "privat" },
      { betrag: -40, kategorie_id: "k2", klassifikation: "privat" },
      { betrag: -50, kategorie_id: "k2", klassifikation: "privat" },
    ]);
    expect(a.anzahl).toBe(5);
    expect(a.haeufigste_kategorie_id).toBe("k1"); // 3x vs 2x
    expect(a.haeufigste_kategorie_anzahl).toBe(3);
    expect(a.haeufigste_klassifikation).toBe("privat"); // 3x vs 2x
  });

  it("Eintraege ohne kategorie_id/klassifikation zaehlen nicht in den Mode", () => {
    const a = aggregiere([
      { betrag: -10, kategorie_id: null, klassifikation: null },
      { betrag: -20, kategorie_id: null, klassifikation: null },
    ]);
    expect(a.haeufigste_kategorie_id).toBeNull();
    expect(a.haeufigste_kategorie_anzahl).toBe(0);
    expect(a.haeufigste_klassifikation).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// holeAehnlicheBuchungen (Supabase-Mock)
// ---------------------------------------------------------------------------

function makeSupabase(result: { data: unknown; error: unknown }) {
  const chain = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  const from = vi.fn(() => ({
    select: vi.fn(() => chain),
  }));
  return { from, chain };
}

describe("holeAehnlicheBuchungen", () => {
  it("liefert null bei leerem empfaenger_normalisiert (kein DB-Call)", async () => {
    const { from } = makeSupabase({ data: [], error: null });
    const res = await holeAehnlicheBuchungen(
      { from } as unknown as Parameters<typeof holeAehnlicheBuchungen>[0],
      "owner-1",
      null,
    );
    expect(res).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("liefert null bei 0 Treffern", async () => {
    const { from } = makeSupabase({ data: [], error: null });
    const res = await holeAehnlicheBuchungen(
      { from } as unknown as Parameters<typeof holeAehnlicheBuchungen>[0],
      "owner-1",
      "acme",
    );
    expect(res).toBeNull();
  });

  it("liefert null bei DB-Fehler", async () => {
    const { from } = makeSupabase({
      data: null,
      error: { message: "RLS denied" },
    });
    const res = await holeAehnlicheBuchungen(
      { from } as unknown as Parameters<typeof holeAehnlicheBuchungen>[0],
      "owner-1",
      "acme",
    );
    expect(res).toBeNull();
  });

  it("aggregiert die DB-Treffer und filtert auf finalisierte Status", async () => {
    const { from, chain } = makeSupabase({
      data: [
        { betrag: -10, kategorie_id: "k1", klassifikation: "geschaeftlich" },
        { betrag: -20, kategorie_id: "k1", klassifikation: "geschaeftlich" },
      ],
      error: null,
    });
    const res = await holeAehnlicheBuchungen(
      { from } as unknown as Parameters<typeof holeAehnlicheBuchungen>[0],
      "owner-1",
      "acme",
    );
    expect(res).not.toBeNull();
    expect(res!.anzahl).toBe(2);
    expect(res!.haeufigste_kategorie_id).toBe("k1");
    expect(chain.in).toHaveBeenCalledWith("status", [
      "auto_verbucht",
      "manuell_bestaetigt",
    ]);
    expect(chain.eq).toHaveBeenCalledWith("owner_id", "owner-1");
    expect(chain.eq).toHaveBeenCalledWith("empfaenger_normalisiert", "acme");
  });

  it("schliesst die aktuelle Buchung via ausschluss_id aus", async () => {
    const { from, chain } = makeSupabase({
      data: [
        { betrag: -10, kategorie_id: "k1", klassifikation: "geschaeftlich" },
      ],
      error: null,
    });
    await holeAehnlicheBuchungen(
      { from } as unknown as Parameters<typeof holeAehnlicheBuchungen>[0],
      "owner-1",
      "acme",
      { ausschluss_id: "self-id" },
    );
    expect(chain.neq).toHaveBeenCalledWith("id", "self-id");
  });

  it("respektiert custom limit", async () => {
    const { from, chain } = makeSupabase({
      data: [
        { betrag: -10, kategorie_id: "k1", klassifikation: "geschaeftlich" },
      ],
      error: null,
    });
    await holeAehnlicheBuchungen(
      { from } as unknown as Parameters<typeof holeAehnlicheBuchungen>[0],
      "owner-1",
      "acme",
      { limit: 25 },
    );
    expect(chain.limit).toHaveBeenCalledWith(25);
  });
});
