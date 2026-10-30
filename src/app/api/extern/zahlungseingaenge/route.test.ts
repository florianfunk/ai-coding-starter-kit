import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const zeilen = [{ id: "b1", buchung_datum: "2026-10-01", betrag: "4569.60", verwendungszweck: "RE 2066", empfaenger: "Kunde AG", konto: { bezeichnung: "Giro" } }];
const filter: unknown[][] = [];
const kette: Record<string, unknown> = {};
for (const m of ["select", "gt", "eq", "is", "in", "order", "range", "gte"]) {
  kette[m] = (...a: unknown[]) => { filter.push([m, ...a]); return kette; };
}
kette.then = (ok: (r: unknown) => void) => ok({ data: zeilen, error: null });

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => kette }) }));

import { GET } from "./route";

const ORIG = process.env.SELLHUGO_API_KEY;
const req = (auth?: string, q = "") => new Request(`https://app.de/api/extern/zahlungseingaenge${q}`, { headers: auth ? { authorization: auth } : {} });

beforeEach(() => { filter.length = 0; process.env.SELLHUGO_API_KEY = "geheim"; });
afterEach(() => { if (ORIG === undefined) delete process.env.SELLHUGO_API_KEY; else process.env.SELLHUGO_API_KEY = ORIG; });

describe("Zahlungseingänge für sellHugo", () => {
  it("ist ohne gültigen Schlüssel zu", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer falsch"))).status).toBe(401);
    delete process.env.SELLHUGO_API_KEY;
    expect((await GET(req("Bearer "))).status).toBe(401);
    expect((await GET(req("Bearer undefined"))).status).toBe(401);
  });

  it("lehnt ein falsches Datum ab", async () => {
    expect((await GET(req("Bearer geheim", "?seit=gestern"))).status).toBe(400);
  });

  it("liefert nur Eingänge von Bank und PayPal, Betrag in Cent", async () => {
    const res = await GET(req("Bearer geheim", "?seit=2020-01-01"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ eingaenge: [{ id: "b1", datum: "2026-10-01", cent: 456960, text: "RE 2066", zahler: "Kunde AG", konto: "Giro" }] });
    expect(filter).toContainEqual(["gt", "betrag", 0]);
    expect(filter).toContainEqual(["in", "konto.typ", ["bank", "paypal"]]);
    expect(filter).toContainEqual(["gte", "buchung_datum", "2020-01-01"]);
  });
});
