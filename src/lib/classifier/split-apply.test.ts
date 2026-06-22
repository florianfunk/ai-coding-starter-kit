import { describe, it, expect, vi } from "vitest";
import {
  baueSplitKinder,
  wendeSplitAn,
  type SplitEltern,
  type SplitDefinition,
} from "./split-apply";

const eltern: SplitEltern = {
  id: "parent-1",
  owner_id: "owner-1",
  konto_id: "konto-1",
  buchung_datum: "2026-01-15",
  betrag: -100,
  verwendungszweck: "Handy-Vertrag",
  empfaenger: "Telekom",
  empfaenger_normalisiert: "telekom",
  waehrung: "EUR",
  duplikat_hash: "hash-123",
};

const def: SplitDefinition = {
  anteil_a: 0.7,
  klassifikation_a: "geschaeftlich",
  kategorie_id_a: "kat-g",
  ust_satz_a: 19,
  klassifikation_b: "privat",
  kategorie_id_b: "kat-p",
  ust_satz_b: 0,
};

describe("baueSplitKinder", () => {
  it("teilt den Betrag korrekt auf zwei Kinder auf (Summe = Eltern)", () => {
    const kinder = baueSplitKinder(eltern, def);
    expect(kinder).toHaveLength(2);
    expect(kinder[0].betrag).toBe(-70);
    expect(kinder[1].betrag).toBe(-30);
    expect(kinder[0].betrag + kinder[1].betrag).toBeCloseTo(eltern.betrag, 2);
  });

  it("setzt parent_buchung_id + split_anteil + Klassifikation/Kategorie", () => {
    const [a, b] = baueSplitKinder(eltern, def);
    expect(a.parent_buchung_id).toBe("parent-1");
    expect(a.split_anteil).toBe(0.7);
    expect(a.klassifikation).toBe("geschaeftlich");
    expect(a.kategorie_id).toBe("kat-g");
    expect(a.steuerrelevant).toBe(true);
    expect(a.ust_satz).toBe(19);
    expect(b.split_anteil).toBeCloseTo(0.3, 4);
    expect(b.klassifikation).toBe("privat");
    expect(b.steuerrelevant).toBe(false);
    expect(b.ust_satz).toBe(0);
  });

  it("erbt Empfänger + normalisierten Schlüssel + Konto + Datum von der Klammer", () => {
    const [a] = baueSplitKinder(eltern, def);
    expect(a.empfaenger).toBe("Telekom");
    expect(a.empfaenger_normalisiert).toBe("telekom");
    expect(a.konto_id).toBe("konto-1");
    expect(a.buchung_datum).toBe("2026-01-15");
    expect(a.owner_id).toBe("owner-1");
  });

  it("erzeugt eindeutige duplikat_hashes pro Kind", () => {
    const [a, b] = baueSplitKinder(eltern, def);
    expect(a.duplikat_hash).not.toBe(b.duplikat_hash);
    expect(a.duplikat_hash).toContain("hash-123");
  });

  it("markiert beide Kinder als manuell_bestaetigt", () => {
    const [a, b] = baueSplitKinder(eltern, def);
    expect(a.status).toBe("manuell_bestaetigt");
    expect(b.status).toBe("manuell_bestaetigt");
  });
});

// --- Mock-Supabase -----------------------------------------------------------

interface MockState {
  inserted: unknown[][];
  parentPatch: Record<string, unknown> | null;
  audits: unknown[];
  insertFail?: boolean;
  updateFail?: boolean;
}

function makeSupabase(state: MockState) {
  return {
    from(table: string) {
      if (table === "buchung") {
        return {
          insert(rows: unknown[]) {
            state.inserted.push(rows);
            return Promise.resolve({
              error: state.insertFail ? { message: "insert fail" } : null,
            });
          },
          update(patch: Record<string, unknown>) {
            state.parentPatch = patch;
            const chain = {
              eq() {
                return chain;
              },
              neq() {
                return Promise.resolve({
                  error: state.updateFail ? { message: "upd fail" } : null,
                });
              },
            };
            return chain;
          },
        };
      }
      if (table === "audit_eintrag") {
        return {
          insert(row: unknown) {
            state.audits.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("wendeSplitAn", () => {
  it("legt zwei Kinder an, friert die Klammer ein und schreibt Audit", async () => {
    const state: MockState = {
      inserted: [],
      parentPatch: null,
      audits: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await wendeSplitAn(makeSupabase(state) as any, eltern, def, {
      aktion: "manuell_aufgeteilt",
      quelle: "nutzer",
      audit_details: { beleg_hinweis: null },
    });
    expect(res.ok).toBe(true);
    expect(state.inserted).toHaveLength(1);
    expect((state.inserted[0] as unknown[]).length).toBe(2);
    expect(state.parentPatch?.status).toBe("manuell_bestaetigt");
    expect(state.parentPatch?.klassifikation).toBe("neutral");
    expect(state.audits).toHaveLength(1);
  });

  it("gibt Fehler zurück, wenn der Kinder-Insert scheitert", async () => {
    const state: MockState = {
      inserted: [],
      parentPatch: null,
      audits: [],
      insertFail: true,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await wendeSplitAn(makeSupabase(state) as any, eltern, def, {
      aktion: "manuell_aufgeteilt",
      quelle: "nutzer",
    });
    expect(res.ok).toBe(false);
    expect(res.fehler).toBe("kinder_insert");
    expect(state.parentPatch).toBeNull();
  });

  it("gibt Fehler zurück, wenn das Einfrieren der Klammer scheitert", async () => {
    const state: MockState = {
      inserted: [],
      parentPatch: null,
      audits: [],
      updateFail: true,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await wendeSplitAn(makeSupabase(state) as any, eltern, def, {
      aktion: "regel_aufgeteilt",
      quelle: "regel",
    });
    expect(res.ok).toBe(false);
    expect(res.fehler).toBe("klammer_update");
  });

  it("nutzt die übergebene Aktion/Quelle im Audit", async () => {
    const state: MockState = {
      inserted: [],
      parentPatch: null,
      audits: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wendeSplitAn(makeSupabase(state) as any, eltern, def, {
      aktion: "regel_aufgeteilt",
      quelle: "regel",
      audit_details: { regel_id: "r-1" },
    });
    const audit = state.audits[0] as Record<string, unknown>;
    expect(audit.aktion).toBe("regel_aufgeteilt");
    expect(audit.quelle).toBe("regel");
    expect((audit.details as Record<string, unknown>).regel_id).toBe("r-1");
  });

  it("schreibt einen Audit-Hash-Suffix-freien Spy ohne zu werfen", async () => {
    const vSpy = vi.fn();
    const state: MockState = {
      inserted: [],
      parentPatch: null,
      audits: [],
    };
    state.audits = { push: vSpy } as unknown as unknown[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await wendeSplitAn(makeSupabase(state) as any, eltern, def, {
      aktion: "manuell_aufgeteilt",
      quelle: "nutzer",
    });
    expect(res.ok).toBe(true);
    expect(vSpy).toHaveBeenCalledOnce();
  });
});
