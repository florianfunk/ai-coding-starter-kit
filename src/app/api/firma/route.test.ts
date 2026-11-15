import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  profil: { ust_va_rhythmus: "monatlich", rhythmus_gueltig_ab: "2026-04-01" } as Record<string, unknown> | null,
  writes: [] as Array<{ method: string; values: Record<string, unknown> }>,
}));
vi.mock("@/lib/auth/guard", () => ({ getApiUser: async () => ({ id: "owner" }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => {
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) q[method] = () => q;
  for (const method of ["insert", "update"]) q[method] = (values: Record<string, unknown>) => {
    state.writes.push({ method, values }); return q;
  };
  q.maybeSingle = async () => ({ data: state.profil, error: null });
  q.single = async () => ({ data: state.profil ?? {}, error: null });
  return q;
} }) }));
import { PUT } from "./route";
import { FIRMENPROFIL_DEFAULTS } from "@/lib/validation/firma";
const req = (overrides = {}) => new Request("https://app.test/api/firma", { method: "PUT", body: JSON.stringify({
  ...FIRMENPROFIL_DEFAULTS, firmenname: "Test", inhaber: "Test", rhythmus_gueltig_ab: "2026-04-01", ...overrides,
}) });
beforeEach(() => { state.profil = { ust_va_rhythmus: "monatlich", rhythmus_gueltig_ab: "2026-04-01" }; state.writes = []; });

it("ändert Stammdaten ohne Rhythmus und Historie erneut zu schreiben", async () => {
  expect((await PUT(req())).status).toBe(200);
  expect(state.writes[0].method).toBe("update");
  expect(state.writes[0].values).not.toHaveProperty("ust_va_rhythmus");
  expect(state.writes[0].values).not.toHaveProperty("rhythmus_gueltig_ab");
  expect(state.writes[0].values).not.toHaveProperty("ust_va_rhythmus_vorher");
});
it("verhindert einen undatierten Rhythmuswechsel über das alte Profilformular", async () => {
  expect((await PUT(req({ ust_va_rhythmus: "quartalsweise" }))).status).toBe(409);
  expect(state.writes).toHaveLength(0);
});
it("kann ein neues Profil mit seinem anfänglichen Rhythmus anlegen", async () => {
  state.profil = null;
  expect((await PUT(req({ ust_va_rhythmus: "quartalsweise" }))).status).toBe(200);
  expect(state.writes[0]).toMatchObject({ method: "insert", values: { owner_id: "owner", ust_va_rhythmus: "quartalsweise" } });
});
