import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "owner" } as { id: string } | null,
  profil: { ust_va_rhythmus: "quartalsweise", ust_va_rhythmus_vorher: null, rhythmus_gueltig_ab: null } as Record<string, unknown> | null,
  abschluesse: [] as unknown[], update: {} as Record<string, unknown> | null,
  calls: [] as unknown[][],
}));
vi.mock("@/lib/auth/guard", () => ({ getApiUser: async () => state.user }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  from: (table: string) => {
    let writing = false;
    const q: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "order", "range", "update", "insert"]) {
      q[method] = (...args: unknown[]) => {
        state.calls.push([table, method, ...args]);
        if (method === "update") writing = true;
        return q;
      };
    }
    q.maybeSingle = async () => ({ data: writing ? state.update : state.profil, error: null });
    q.then = (ok: (v: unknown) => void) => ok({ data: table === "steuerperiode" ? state.abschluesse : null, error: null });
    return q;
  },
}) }));

import { PATCH } from "./route";
const req = (datum: string) => new Request("https://app.test/api/firma/ust-rhythmus", {
  method: "PATCH", body: JSON.stringify({ rhythmus_gueltig_ab: datum }),
});
beforeEach(() => {
  state.user = { id: "owner" };
  state.profil = { ust_va_rhythmus: "quartalsweise", ust_va_rhythmus_vorher: null, rhythmus_gueltig_ab: null };
  state.abschluesse = [];
  state.update = { ust_va_rhythmus: "monatlich", ust_va_rhythmus_vorher: "quartalsweise", rhythmus_gueltig_ab: "2026-04-01" };
  state.calls = [];
});
describe("Datierter USt-Rhythmuswechsel", () => {
  it("stellt ab April um, schützt den Owner und erhält den Q1-Abschluss", async () => {
    const snapshot = { zeitraum: { von: "2026-01-01", bis: "2026-03-31" }, summe: { zahllast: 123 } };
    state.abschluesse = [{ jahr: 2026, periode: 1, snapshot }];
    expect((await PATCH(req("2026-04-01"))).status).toBe(200);
    expect(state.calls).toContainEqual(["firmenprofil", "update", state.update]);
    expect(state.calls).toContainEqual(["firmenprofil", "eq", "owner_id", "owner"]);
    expect(state.calls).toContainEqual(["steuerperiode", "eq", "owner_id", "owner"]);
    expect(state.calls).toContainEqual(["firmenprofil", "is", "ust_va_rhythmus_vorher", null]);
    expect(state.calls.some((c) => c[0] === "steuerperiode" && c[1] === "update")).toBe(false);
    expect(snapshot.summe.zahllast).toBe(123);
    // Das Audit wird transaktional vom Datenbanktrigger geschrieben.
    expect(state.calls.some((c) => c[0] === "audit_eintrag")).toBe(false);
  });
  it("verhindert, dass ein vorhandener Q2-Abschluss zum Monatsabschluss wird", async () => {
    state.abschluesse = [{ jahr: 2026, periode: 2, snapshot: { zeitraum: { von: "2026-04-01", bis: "2026-06-30" } } }];
    const res = await PATCH(req("2026-04-01"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/abgeschlossener Zeitraum/);
    expect(state.calls.some((c) => c[1] === "update")).toBe(false);
  });
  it("lehnt ungültige Termine und Termine mitten im Quartal ab", async () => {
    for (const datum of ["2026-04-15", "2026-05-01", "2026-02-30", "2026-13-01", "1999-04-01"]) {
      expect((await PATCH(req(datum))).status).toBe(422);
    }
    expect(state.calls).toHaveLength(0);
  });
  it("verhindert anonymen Zugriff und einen Wechsel ohne vierteljährliche Ausgangslage", async () => {
    state.user = null;
    expect((await PATCH(req("2026-04-01"))).status).toBe(401);
    expect(state.calls).toHaveLength(0);
    state.user = { id: "owner" };
    state.profil = { ust_va_rhythmus: "monatlich", ust_va_rhythmus_vorher: null, rhythmus_gueltig_ab: null };
    expect((await PATCH(req("2026-07-01"))).status).toBe(409);
    expect(state.calls.some((c) => c[1] === "update")).toBe(false);
  });
  it("korrigiert den Termin bei erhaltener Ausgangslage mit einer Versionsprüfung", async () => {
    state.profil = { ust_va_rhythmus: "monatlich", ust_va_rhythmus_vorher: "quartalsweise", rhythmus_gueltig_ab: "2026-04-01" };
    expect((await PATCH(req("2026-07-01"))).status).toBe(200);
    expect(state.calls).toContainEqual(["firmenprofil", "eq", "rhythmus_gueltig_ab", "2026-04-01"]);
    expect(state.calls).toContainEqual(["firmenprofil", "eq", "ust_va_rhythmus_vorher", "quartalsweise"]);
  });
  it("meldet einen konkurrierenden Profilwechsel statt Erfolg zu behaupten", async () => {
    state.update = null;
    expect((await PATCH(req("2026-04-01"))).status).toBe(409);
    expect(state.calls.some((c) => c[0] === "audit_eintrag")).toBe(false);
  });
});
