import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ failFrom: Infinity, pages: [] as number[] }));
vi.mock("@/lib/auth/guard", () => ({ getApiUser: async () => ({ id: "owner" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      let from = 0;
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => {
          if (field === "owner_id") expect(value).toBe("owner");
          return query;
        },
        in: () => query,
        order: () => query,
        limit: () => query,
        range: (start: number) => { from = start; db.pages.push(start); return query; },
        then: (resolve: (value: unknown) => unknown) => {
          if (table === "job_lauf") return Promise.resolve({ data: [
            { id: "old", konto_id: null, ergebnis: { importiert: 1500 } },
            { id: "new", konto_id: null, ergebnis: { importiert: 290 } },
          ], error: null }).then(resolve);
          if (from >= db.failFrom) return Promise.resolve({ data: null, error: { message: "offline" } }).then(resolve);
          const rows = Array.from({ length: 1790 }, (_, i) => ({ import_lauf_id: i < 1500 ? "old" : "new" }));
          return Promise.resolve({ data: rows.slice(from, from + 1000), error: null }).then(resolve);
        },
      };
      return query;
    },
  }),
}));

import { GET } from "./route";

describe("Importhistorie: vollständige Buchungszahlen", () => {
  beforeEach(() => { db.failFrom = Infinity; db.pages = []; });

  it("zählt auch neue Importe jenseits der ersten 1000 Buchungen", async () => {
    const response = await GET();
    const { data } = await response.json();
    expect(data.map((r: { buchungen_aktuell: number }) => r.buchungen_aktuell)).toEqual([1500, 290]);
    expect(db.pages).toEqual([0, 1000]);
  });

  it("liefert bei Fehlern keine irreführenden Teilzahlen oder Nullwerte", async () => {
    db.failFrom = 1000;
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty("data");
  });
});
