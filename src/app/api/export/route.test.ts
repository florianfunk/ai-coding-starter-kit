import { expect, it, vi } from "vitest";
vi.mock("@/lib/auth/guard", () => ({ getApiUser: async () => ({ id: "owner" }) }));
vi.mock("@/lib/export/pdf", () => ({ euerPdf: vi.fn(), ustvaPdf: vi.fn(), privatentnahmenPdf: vi.fn(), elsterPdf: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: (table: string) => {
  const data = table === "firmenprofil" ? {
    firmenname: "Test", ust_status: "regelbesteuerung", ust_va_rhythmus: "monatlich",
    ust_va_rhythmus_vorher: "quartalsweise", rhythmus_gueltig_ab: "2026-04-01",
  } : table === "steuerperiode" ? null : table === "buchung" ? [
    { id: "maerz", buchung_datum: "2026-03-31", betrag: 1190, ust_satz: 19, klassifikation: "geschaeftlich", steuerrelevant: true },
    { id: "april", buchung_datum: "2026-04-01", betrag: 119, ust_satz: 19, klassifikation: "geschaeftlich", steuerrelevant: true },
    { id: "mai", buchung_datum: "2026-05-01", betrag: 2380, ust_satz: 19, klassifikation: "geschaeftlich", steuerrelevant: true },
  ] : [];
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte", "order", "range", "limit"]) q[method] = () => q;
  q.maybeSingle = async () => ({ data, error: null });
  q.then = (ok: (v: unknown) => void) => ok({ data, error: null });
  return q;
} }) }));
import { POST } from "./route";
const req = (periode: number) => new Request("https://app.test/api/export", { method: "POST", body: JSON.stringify({
  typ: "elster", format: "csv", jahr: 2026, periode,
}) });

it("exportiert April als eigenen Monat mit ausschließlich April-Buchungen", async () => {
  const res = await POST(req(4));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-disposition")).toContain("April2026");
  expect(await res.text()).toContain("100,00;19,00");
});
it("verhindert den Export der alten Q2-Nummer nach dem Wechsel", async () => {
  expect((await POST(req(2))).status).toBe(422);
});
