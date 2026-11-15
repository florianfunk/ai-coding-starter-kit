import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  snapshot: null as Record<string, unknown> | null,
  writes: [] as unknown[],
}));
vi.mock("@/lib/auth/guard", () => ({ getApiUser: async () => ({ id: "owner" }) }));
vi.mock("@/lib/tax/rueckstellung-version", () => ({ ladeRueckstellungsVersion: async () => 0 }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  from: (table: string) => {
    const data = table === "firmenprofil" ? {
      ust_status: "regelbesteuerung", ust_va_rhythmus: "monatlich",
      ust_va_rhythmus_vorher: "quartalsweise", rhythmus_gueltig_ab: "2026-04-01",
    } : table === "steuerperiode" ? (state.snapshot ? {
      id: "periode", status: "abgeschlossen", snapshot: state.snapshot, abgeschlossen_at: "2026-04-10",
    } : null) : table === "buchung" ? [
      { id: "jan", buchung_datum: "2026-01-01", betrag: 119, klassifikation: "geschaeftlich", steuerrelevant: true, ust_satz: 19 },
      { id: "maerz", buchung_datum: "2026-03-31", betrag: 119, klassifikation: "geschaeftlich", steuerrelevant: true, ust_satz: 19 },
      { id: "april", buchung_datum: "2026-04-01", betrag: 119, klassifikation: "geschaeftlich", steuerrelevant: true, ust_satz: 19 },
      { id: "mai", buchung_datum: "2026-05-01", betrag: 1190, klassifikation: "geschaeftlich", steuerrelevant: true, ust_satz: 19 },
    ] : [];
    const q: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "gte", "lte", "order", "range", "limit", "insert", "update"]) {
      q[method] = (...args: unknown[]) => { if (method === "insert" && table === "steuerperiode") state.writes.push(args[0]); return q; };
    }
    q.maybeSingle = async () => ({ data, error: null });
    q.then = (ok: (v: unknown) => void) => ok({ data, error: null });
    return q;
  },
}) }));
import { GET, POST } from "./route";
beforeEach(() => { state.snapshot = null; state.writes = []; });

it("berechnet April einzeln und behält Q1 in der Jahresübersicht", async () => {
  const res = await GET(new Request("https://app.test/api/steuer/ust?jahr=2026&periode=4"));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.periode_label).toBe("April 2026");
  expect(json.rhythmus).toBe("monatlich");
  expect(json.berechnung.summe.umsatzsteuer).toBe(19);
  expect(Object.keys(json.buchung_details)).toEqual(["april"]);
  expect(json.jahresuebersicht.map((p: { periode: number }) => p.periode)).toEqual([1, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});
it("liefert den unveränderten Q1-Snapshot als Quartal", async () => {
  state.snapshot = { zeitraum: { von: "2026-01-01", bis: "2026-03-31" }, rhythmus: "quartalsweise", summe: { zahllast: 99 } };
  const res = await GET(new Request("https://app.test/api/steuer/ust?jahr=2026&periode=1"));
  const json = await res.json();
  expect(json.periode_label).toBe("Q1 2026");
  expect(json.rhythmus).toBe("quartalsweise");
  expect(json.berechnung).toEqual(state.snapshot);
  expect(Object.keys(json.buchung_details)).toEqual(["jan", "maerz"]);
});
it("speichert einen Monatsabschluss mit den exakten April-Grenzen", async () => {
  const res = await POST(new Request("https://app.test/api/steuer/ust", { method: "POST", body: JSON.stringify({ jahr: 2026, periode: 4 }) }));
  expect(res.status).toBe(200);
  expect(state.writes[0]).toMatchObject({ jahr: 2026, periode: 4, snapshot: {
    rhythmus: "monatlich", zeitraum: { von: "2026-04-01", bis: "2026-04-30" },
  } });
});
it("weist die alte Q2-Nummer im Wechseljahr ab", async () => {
  expect((await GET(new Request("https://app.test/api/steuer/ust?jahr=2026&periode=2"))).status).toBe(422);
});
