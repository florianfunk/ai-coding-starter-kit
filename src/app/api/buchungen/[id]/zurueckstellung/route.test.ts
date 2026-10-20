import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "owner-test" } as { id: string } | null,
  vorher: null as Record<string, unknown> | null,
  nachher: null as Record<string, unknown> | null,
  error: null as { code: string; message: string } | null,
  update: vi.fn(), eq: vi.fn(), is: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({ getApiUser: async () => mocks.user }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => {
    let mutation = false;
    const q = {
      select: () => q,
      update: (data: unknown) => { mutation = true; mocks.update(data); return q; },
      eq: (field: string, value: unknown) => { mocks.eq(field, value); return q; },
      is: (field: string, value: unknown) => { mocks.is(field, value); return q; },
      maybeSingle: async () => ({ data: mutation ? mocks.nachher : mocks.vorher, error: mutation ? mocks.error : null }),
    };
    return q;
  } }),
}));
import { POST } from "./route";

const id = "a6e91b62-dcfb-40eb-a6f0-9b7157cf6251";
const request = (body: unknown) => new Request(`http://localhost/api/buchungen/${id}/zurueckstellung`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const params = { params: Promise.resolve({ id }) };
const hold = { aktion: "zurueckstellen", grund: "Rechnung strittig", erwartet_am: null };

describe("Rückstellung API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "owner-test" };
    mocks.vorher = { id, steuer_zurueckgestellt: false, steuer_zurueckgestellt_grund: null, steuer_zurueckgestellt_am: null };
    mocks.nachher = { id, steuer_zurueckgestellt: true, steuer_zurueckgestellt_grund: "Rechnung strittig", steuer_zurueckgestellt_am: "2026-10-20T15:00:00Z" };
    mocks.error = null;
  });
  it("verweigert nicht angemeldeten Zugriff", async () => {
    mocks.user = null;
    expect((await POST(request(hold), params)).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("lehnt leeren Grund ab", async () => {
    expect((await POST(request({ ...hold, grund: " " }), params)).status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("behandelt fremde/nicht sichtbare Buchungen als nicht gefunden", async () => {
    mocks.vorher = null;
    expect((await POST(request(hold), params)).status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("schreibt nur Rückstellung und Grund, owner-scoped mit Versionsvergleich", async () => {
    const result = await POST(request(hold), params);
    expect(result.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ steuer_zurueckgestellt: true, steuer_zurueckgestellt_grund: "Rechnung strittig" });
    expect(mocks.eq).toHaveBeenCalledWith("owner_id", "owner-test");
    expect(mocks.eq).toHaveBeenCalledWith("id", id);
    expect(mocks.is).toHaveBeenCalledWith("steuer_zurueckgestellt_am", null);
  });
  it("verweigert einen veralteten Stand", async () => {
    mocks.nachher = null;
    expect((await POST(request(hold), params)).status).toBe(409);
  });
  it("gibt Perioden-/Split-Sperren verständlich als Konflikt zurück", async () => {
    mocks.error = { code: "P0001", message: "Die Steuerperiode ist bereits abgeschlossen." };
    const result = await POST(request(hold), params);
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ error: mocks.error.message });
  });
  it("nimmt nur die Rückstellung zurück und toleriert identische Wiederholungen", async () => {
    const am = "2026-10-20T15:00:00Z";
    mocks.vorher = mocks.nachher;
    expect((await POST(request(hold), params)).status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.nachher = { id, steuer_zurueckgestellt: false, steuer_zurueckgestellt_grund: null, steuer_zurueckgestellt_am: null };
    expect((await POST(request({ aktion: "wiederaufnehmen", erwartet_am: am }), params)).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ steuer_zurueckgestellt: false, steuer_zurueckgestellt_grund: null });
    expect(mocks.eq).toHaveBeenCalledWith("steuer_zurueckgestellt_am", am);
  });
});
