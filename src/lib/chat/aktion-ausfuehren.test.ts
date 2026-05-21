// PROJ-17 — Tests fuer brecheAktionAb + fuehreAktionAus.
//
// Fokus: Idempotenz, Status-Wechsel, Owner-Check, Lost-Update-Schutz.
// Wir mocken Supabase pro Test nur soweit wie noetig, damit die Logik klar
// lesbar bleibt.

import { describe, expect, it, vi } from "vitest";
import {
  brecheAktionAb,
  fuehreAktionAus,
  type AktionRow,
} from "./aktion-ausfuehren";

// ---------------------------------------------------------------------------
// Mock-Builder
// ---------------------------------------------------------------------------

interface QueryStub {
  data: unknown;
  error: unknown;
}

function aktionFixture(over: Partial<AktionRow> = {}): AktionRow {
  return {
    id: "akt-1",
    owner_id: "owner-1",
    konversation_id: "konv-1",
    nachricht_id: "nachr-1",
    aktion: "lege_kategorie_an",
    parameter: { bezeichnung: "Beratung", typ: "ausgabe" },
    vorschau: "Neue Kategorie wird angelegt: Beratung.",
    vorher_nachher: null,
    status: "pending_confirm",
    audit_eintrag_id: null,
    fehler_text: null,
    ...over,
  };
}

/**
 * Baut einen Supabase-Mock fuer die Aktions-Ausfuehrer-Tests.
 *
 * - `chat_aktion.select(...).eq(...).eq(...).maybeSingle()` -> liefert
 *   `aktion` (oder null wenn `aktion=null`)
 * - `chat_aktion.update(...)` -> sammelt den Patch in `updates`
 * - alle anderen Tabellen-Operationen werden generisch als no-op gemockt
 */
function makeSupabase(opts: {
  aktion: AktionRow | null;
  // Optional: weitere Tabellen-Queries (z. B. fuer Lost-Update-Check)
  selectByTable?: Record<string, QueryStub>;
  insertResult?: QueryStub;
  updateResult?: QueryStub;
  deleteResult?: QueryStub;
}) {
  const updates: Array<Record<string, unknown>> = [];

  function chatAktionSelectChain() {
    return {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: opts.aktion, error: null }),
    };
  }
  function chatAktionUpdate(patch: Record<string, unknown>) {
    updates.push(patch);
    // M2-Fix: setzeStatus() chained jetzt .eq("owner_id").eq("id") fuer
    // Defense-in-Depth. Mock muss daher chainbar sein.
    const finalThenable = vi
      .fn()
      .mockResolvedValue(opts.updateResult ?? { data: null, error: null });
    return {
      eq: vi.fn(() => ({ eq: finalThenable })),
    };
  }
  function generischeChain(tabelle: string) {
    const stub =
      opts.selectByTable?.[tabelle] ?? { data: null, error: null };
    return {
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(stub),
        single: vi.fn().mockResolvedValue(stub),
        then: undefined,
      })),
      insert: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(opts.insertResult ?? { data: null, error: null }),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue(opts.updateResult ?? { data: null, error: null }),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue(opts.deleteResult ?? { data: null, error: null }),
      })),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  }

  const from = vi.fn((tabelle: string) => {
    if (tabelle === "chat_aktion") {
      return {
        select: vi.fn(() => chatAktionSelectChain()),
        update: vi.fn((patch: Record<string, unknown>) => chatAktionUpdate(patch)),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    return generischeChain(tabelle);
  });

  return { from, updates };
}

// ---------------------------------------------------------------------------
// brecheAktionAb
// ---------------------------------------------------------------------------

describe("brecheAktionAb", () => {
  it("not_found, wenn Aktion nicht existiert", async () => {
    const { from } = makeSupabase({ aktion: null });
    const res = await brecheAktionAb(
      { from } as never,
      "owner-1",
      "akt-1",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("not_found");
      expect(res.status).toBe(404);
    }
  });

  it("setzt pending_confirm → cancelled", async () => {
    const { from, updates } = makeSupabase({
      aktion: aktionFixture({ status: "pending_confirm" }),
    });
    const res = await brecheAktionAb(
      { from } as never,
      "owner-1",
      "akt-1",
    );
    expect(res.ok).toBe(true);
    expect(updates).toContainEqual(
      expect.objectContaining({ status: "cancelled" }),
    );
  });

  it("ist idempotent: cancelled → ok", async () => {
    const { from, updates } = makeSupabase({
      aktion: aktionFixture({ status: "cancelled" }),
    });
    const res = await brecheAktionAb(
      { from } as never,
      "owner-1",
      "akt-1",
    );
    expect(res.ok).toBe(true);
    // Kein zweiter Status-Wechsel.
    expect(updates).toEqual([]);
  });

  it("confirmed → 409 conflict", async () => {
    const { from } = makeSupabase({
      aktion: aktionFixture({ status: "confirmed" }),
    });
    const res = await brecheAktionAb(
      { from } as never,
      "owner-1",
      "akt-1",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("conflict");
      expect(res.status).toBe(409);
    }
  });
});

// ---------------------------------------------------------------------------
// fuehreAktionAus — Status-Idempotenz
// ---------------------------------------------------------------------------

describe("fuehreAktionAus — Status-Idempotenz", () => {
  it("not_found, wenn Aktion nicht existiert", async () => {
    const { from } = makeSupabase({ aktion: null });
    const res = await fuehreAktionAus(
      { from } as never,
      "owner-1",
      "akt-1",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("not_found");
      expect(res.status).toBe(404);
    }
  });

  it("409 conflict bei bereits confirmed", async () => {
    const { from } = makeSupabase({
      aktion: aktionFixture({ status: "confirmed" }),
    });
    const res = await fuehreAktionAus(
      { from } as never,
      "owner-1",
      "akt-1",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("conflict");
      expect(res.status).toBe(409);
    }
  });

  it("409 conflict bei bereits cancelled", async () => {
    const { from } = makeSupabase({
      aktion: aktionFixture({ status: "cancelled" }),
    });
    const res = await fuehreAktionAus(
      { from } as never,
      "owner-1",
      "akt-1",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("conflict");
      expect(res.status).toBe(409);
    }
  });

  it("422 validation bei unbekanntem Tool-Namen", async () => {
    const { from } = makeSupabase({
      aktion: aktionFixture({ aktion: "explodiere_alles" }),
    });
    const res = await fuehreAktionAus(
      { from } as never,
      "owner-1",
      "akt-1",
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("validation");
      expect(res.status).toBe(422);
    }
  });
});
