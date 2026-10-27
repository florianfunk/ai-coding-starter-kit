import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Buchung, Kategorie } from "@/lib/types";
import { berechneEuer } from "@/lib/tax/euer";
import { berechneUstVa, type UstBuchung } from "@/lib/tax/ust";

const ids = { booking: "00000000-0000-4000-8000-000000000001", category: "00000000-0000-4000-8000-000000000002" };
const db = vi.hoisted(() => ({ row: {} as Record<string, unknown>, updates: {} as Record<string, unknown>,
  audits: [] as Record<string, unknown>[], categoryFound: true, bookingFound: true }));
vi.mock("@/lib/auth/guard", () => ({ getApiUser: async () => ({ id: "owner" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => {
    let writing = false;
    const query = {
      select: () => query, limit: () => query, in: () => query,
      eq: (field: string, value: unknown) => { if (field === "owner_id") expect(value).toBe("owner"); return query; },
      maybeSingle: async () => ({ data: db.categoryFound ? { id: "00000000-0000-4000-8000-000000000002", typ: "privat", bezeichnung: "Privat", ust_satz: null } : null, error: null }),
      update: (updates: Record<string, unknown>) => { writing = true; db.updates = updates; return query; },
      insert: (rows: Record<string, unknown>[]) => { db.audits = rows; return query; },
      then: (resolve: (value: unknown) => unknown) => {
        if (table === "audit_eintrag") return Promise.resolve({ data: null, error: null }).then(resolve);
        if (!db.bookingFound) return Promise.resolve({ data: [], error: null }).then(resolve);
        const before = { ...db.row };
        if (writing) db.row = { ...db.row, ...db.updates };
        return Promise.resolve({ data: [writing ? { ...db.row } : before], error: null }).then(resolve);
      },
    };
    return query;
  } }),
}));
import { POST } from "./route";

beforeEach(() => {
  db.row = { id: ids.booking, buchung_datum: "2025-11-27", betrag: 1190, klassifikation: "geschaeftlich",
    steuerrelevant: true, ust_satz: 19, kategorie_id: "income", status: "auto_verbucht", belegt: true,
    steuer_zurueckgestellt: false, steuer_zurueckstellung_version: 6 };
  db.updates = {}; db.audits = []; db.categoryFound = true; db.bookingFound = true;
});
const request = () => new Request("http://localhost/api/buchungen/bulk-kategorie", { method: "POST",
  headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [ids.booking], kategorie_id: ids.category }) });

describe("Privatkategorie: Umbuchung und Steuerwirkung", () => {
  it.each([1190, -119])("nimmt %s Euro aus EÜR und USt, bestätigt manuell und erhält Rückstellungen", async (betrag) => {
    db.row.betrag = betrag;
    db.row.kategorie_id = betrag > 0 ? "income" : "expense";
    const categories = [{ id: "income", typ: "einnahme", bezeichnung: "Erlöse" },
      { id: "expense", typ: "ausgabe", bezeichnung: "Kosten" }, { id: ids.category, typ: "privat", bezeichnung: "Privat" }] as Kategorie[];
    const before = { ...db.row } as unknown as Buchung;
    expect(berechneEuer([before], categories, 2025, 1).gewinn).toBe(betrag);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).aktualisiert).toBe(1);
    expect(db.updates).toEqual({ kategorie_id: ids.category, klassifikation: "privat", steuerrelevant: false,
      ust_satz: null, status: "manuell_bestaetigt", quelle: "manuell", pruef_grund: null });
    expect(db.row.steuer_zurueckstellung_version).toBe(6);
    expect(db.row.steuer_zurueckgestellt).toBe(false);
    const after = db.row as unknown as Buchung;
    expect(berechneEuer([after], categories, 2025, 1)).toEqual(berechneEuer([], categories, 2025, 1));
    expect(berechneUstVa([after as unknown as UstBuchung], 2025, 4, "regelbesteuerung"))
      .toEqual(berechneUstVa([], 2025, 4, "regelbesteuerung"));
    expect(db.audits[0]).toMatchObject({ owner_id: "owner", entitaet_id: ids.booking, quelle: "nutzer",
      details: { vorher: before, nachher: db.row } });
  });
  it("ändert keine Buchungen bei einer fremden oder fehlenden Kategorie", async () => {
    db.categoryFound = false;
    expect((await POST(request())).status).toBe(404);
    expect(db.updates).toEqual({});
    expect(db.audits).toHaveLength(0);
  });
  it("überspringt fremde oder fehlende Buchungen ohne Änderung und Audit", async () => {
    db.bookingFound = false;
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ aktualisiert: 0, uebersprungen: [ids.booking] });
    expect(db.updates).toEqual({});
    expect(db.audits).toHaveLength(0);
  });
});
