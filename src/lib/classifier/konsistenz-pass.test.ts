// PROJ-15 (Konsistenz-Pro) — Tests fuer den Konsistenz-Pass.
//
// Wir testen einerseits die REINE `bestimmeMehrheit`-Funktion (deterministisch
// ohne DB), andererseits den end-to-end-Pass `wendeKonsistenzPassAn` mit
// einem minimalen Mock-Supabase, der das Such-/Update-/Insert-Verhalten
// abbildet — analog zum `makePipelineSupabase`-Pattern aus pipeline.test.ts.

import { describe, expect, it, vi } from "vitest";
import {
  bestimmeMehrheit,
  wendeKonsistenzPassAn,
  type KonsistenzPassResultat,
} from "./konsistenz-pass";

type Status = "offen" | "auto_verbucht" | "zur_pruefung" | "manuell_bestaetigt";

interface BuchungRow {
  id: string;
  empfaenger_normalisiert: string | null;
  kategorie_id: string | null;
  klassifikation: "privat" | "geschaeftlich" | "neutral" | "unklar" | null;
  steuerrelevant: boolean | null;
  ust_satz: number | null;
  status: Status;
  konfidenz: number | null;
  pruef_grund: string | null;
}

function row(p: Partial<BuchungRow> = {}): BuchungRow {
  return {
    id: p.id ?? `b-${Math.random().toString(36).slice(2, 8)}`,
    empfaenger_normalisiert: p.empfaenger_normalisiert ?? "acme",
    kategorie_id: p.kategorie_id ?? "kat-a",
    klassifikation: p.klassifikation ?? "geschaeftlich",
    steuerrelevant: p.steuerrelevant ?? true,
    ust_satz: p.ust_satz ?? 19,
    status: p.status ?? "auto_verbucht",
    konfidenz: p.konfidenz ?? 0.9,
    pruef_grund: p.pruef_grund ?? null,
  };
}

// ---------------------------------------------------------------------------
// Reine Funktion — bestimmeMehrheit
// ---------------------------------------------------------------------------

describe("bestimmeMehrheit — reine Mehrheits-Entscheidung", () => {
  it("3x Kategorie A + 1x Kategorie B → angepasst auf A", () => {
    const buchungen = [
      row({ id: "1", kategorie_id: "kat-a", konfidenz: 0.95 }),
      row({ id: "2", kategorie_id: "kat-a", konfidenz: 0.9 }),
      row({ id: "3", kategorie_id: "kat-a", konfidenz: 0.92 }),
      row({ id: "4", kategorie_id: "kat-b", konfidenz: 0.7 }),
    ];
    const e = bestimmeMehrheit(buchungen);
    expect(e.angepasst).toBe(true);
    expect(e.mehrheits_kategorie_id).toBe("kat-a");
    expect(e.mehrheits_anzahl).toBe(3);
    expect(e.gesamt_auto).toBe(4);
  });

  it("2x A + 2x B → keine 60%-Mehrheit, NICHT angepasst", () => {
    const buchungen = [
      row({ id: "1", kategorie_id: "kat-a", konfidenz: 0.95 }),
      row({ id: "2", kategorie_id: "kat-a", konfidenz: 0.9 }),
      row({ id: "3", kategorie_id: "kat-b", konfidenz: 0.92 }),
      row({ id: "4", kategorie_id: "kat-b", konfidenz: 0.95 }),
    ];
    const e = bestimmeMehrheit(buchungen);
    expect(e.angepasst).toBe(false);
    expect(e.grund).toBe("keine_mehrheit");
  });

  it("Mehrheits-Konfidenz unter 0.85 → NICHT angepasst", () => {
    const buchungen = [
      row({ id: "1", kategorie_id: "kat-a", konfidenz: 0.6 }),
      row({ id: "2", kategorie_id: "kat-a", konfidenz: 0.7 }),
      row({ id: "3", kategorie_id: "kat-a", konfidenz: 0.75 }),
      row({ id: "4", kategorie_id: "kat-b", konfidenz: 0.95 }),
    ];
    const e = bestimmeMehrheit(buchungen);
    expect(e.angepasst).toBe(false);
    expect(e.grund).toBe("konfidenz_zu_niedrig");
  });

  it("Mischklassifikation privat + geschaeftlich → NICHT angepasst", () => {
    const buchungen = [
      row({
        id: "1",
        kategorie_id: "kat-priv",
        klassifikation: "privat",
        steuerrelevant: false,
        konfidenz: 0.95,
      }),
      row({
        id: "2",
        kategorie_id: "kat-priv",
        klassifikation: "privat",
        steuerrelevant: false,
        konfidenz: 0.95,
      }),
      row({
        id: "3",
        kategorie_id: "kat-priv",
        klassifikation: "privat",
        steuerrelevant: false,
        konfidenz: 0.95,
      }),
      row({
        id: "4",
        kategorie_id: "kat-gesch",
        klassifikation: "geschaeftlich",
        konfidenz: 0.95,
      }),
    ];
    const e = bestimmeMehrheit(buchungen);
    expect(e.angepasst).toBe(false);
    expect(e.grund).toBe("mischklassifikation");
  });

  it("PayPal-Pattern: 3x Privat + 1x Neutral (Geldtransit) → NICHT angepasst (Mischklassifikation)", () => {
    // Genau das real beobachtete Szenario aus der DB-Diagnose: PayPal mit
    // privat=Mehrheit und neutral=Geldtransit-Buchungen — die 4 Geldtransit-
    // Buchungen bleiben unangetastet.
    const buchungen = [
      row({
        id: "1",
        kategorie_id: "kat-priv",
        klassifikation: "privat",
        steuerrelevant: false,
        konfidenz: 0.92,
      }),
      row({
        id: "2",
        kategorie_id: "kat-priv",
        klassifikation: "privat",
        steuerrelevant: false,
        konfidenz: 0.92,
      }),
      row({
        id: "3",
        kategorie_id: "kat-priv",
        klassifikation: "privat",
        steuerrelevant: false,
        konfidenz: 0.92,
      }),
      row({
        id: "4",
        kategorie_id: "kat-geldtransit",
        klassifikation: "neutral",
        steuerrelevant: false,
        konfidenz: 0.95,
      }),
    ];
    const e = bestimmeMehrheit(buchungen);
    expect(e.angepasst).toBe(false);
    expect(e.grund).toBe("mischklassifikation");
  });

  it("Alle gleiche Kategorie → 'konsistent', NICHT angepasst (keine Inkonsistenz)", () => {
    const buchungen = [
      row({ id: "1", kategorie_id: "kat-a" }),
      row({ id: "2", kategorie_id: "kat-a" }),
      row({ id: "3", kategorie_id: "kat-a" }),
    ];
    const e = bestimmeMehrheit(buchungen);
    expect(e.angepasst).toBe(false);
    expect(e.grund).toBe("konsistent");
  });

  it("Nur zur_pruefung-Buchungen → keine_auto_verbucht (kein Massstab)", () => {
    const buchungen = [
      row({ id: "1", status: "zur_pruefung", kategorie_id: "kat-a" }),
      row({ id: "2", status: "zur_pruefung", kategorie_id: "kat-b" }),
      row({ id: "3", status: "zur_pruefung", kategorie_id: "kat-c" }),
    ];
    const e = bestimmeMehrheit(buchungen);
    expect(e.angepasst).toBe(false);
    expect(e.grund).toBe("keine_auto_verbucht");
  });
});

// ---------------------------------------------------------------------------
// Mock-Supabase fuer wendeKonsistenzPassAn
// ---------------------------------------------------------------------------

interface MockState {
  buchungen: BuchungRow[];
}

function makeSupabase(state: MockState) {
  const updateSpy = vi.fn();
  const auditInsertSpy = vi.fn();

  function makeBuchungChain() {
    const filter: {
      owner_id?: string;
      status_list?: string[];
      empfaenger_not_null?: boolean;
    } = {};

    type Chain = {
      eq: (col: string, val: string) => Chain;
      in: (col: string, val: string[]) => Chain;
      not: (col: string, op: string, val: unknown) => Chain;
      limit: (n: number) => Promise<{ data: BuchungRow[] | null; error: null }>;
    };

    const chain: Chain = {
      eq: (col: string, val: string) => {
        if (col === "owner_id") filter.owner_id = val;
        return chain;
      },
      in: (col: string, val: string[]) => {
        if (col === "status") filter.status_list = val;
        return chain;
      },
      not: (col: string, op: string) => {
        if (col === "empfaenger_normalisiert" && op === "is") {
          filter.empfaenger_not_null = true;
        }
        return chain;
      },
      limit: async () => {
        // WICHTIG: Wir liefern KOPIEN der Rows, damit nachgelagerte
        // Update-Patches im Mock nicht versehentlich die `data`-Referenz
        // anpassen, die der Caller waehrend des Pass-Laufs noch in Haenden
        // hat. Ohne diese Kopie wuerde z. B. `b.kategorie_id` im Audit-
        // Insert bereits den NACHHER-Wert tragen.
        const result = state.buchungen
          .filter((b) => {
            if (filter.status_list && !filter.status_list.includes(b.status)) {
              return false;
            }
            if (filter.empfaenger_not_null && !b.empfaenger_normalisiert) {
              return false;
            }
            return true;
          })
          .map((b) => ({ ...b }));
        return { data: result, error: null };
      },
    };
    return chain;
  }

  function makeBuchungUpdate(patch: Partial<BuchungRow>) {
    const filter: { id?: string; owner_id?: string } = {};
    let neqStatus: string | null = null;
    type Chain = {
      eq: (col: string, val: string) => Promise<{ error: null }> | Chain;
      neq: (col: string, val: string) => Chain;
    };
    const chain: Chain = {
      eq: (col: string, val: string) => {
        if (col === "id") filter.id = val;
        if (col === "owner_id") {
          filter.owner_id = val;
        }
        // letzte eq() = Promise. Eigentlich kommt eq, eq, neq → wir muessen
        // robust unterscheiden. Wir geben einfach immer den chain zurueck.
        return chain;
      },
      neq: (col: string, val: string) => {
        if (col === "status") neqStatus = val;
        return chain;
      },
    };

    // Wir koennen die Update-Pseudo-Promise via Microtask aufloesen — der
    // Test ruft `await supabase.from(...).update(...).eq(...).eq(...).neq(...)`.
    // Wir wickeln das als Thenable nach den eq/neq-Calls ab.
    // Vereinfachung: chain.eq() kann sowohl Chain als auch Promise sein —
    // wir lassen den letzten eq als Promise wirken, in dem chain ein .then
    // hat.
    const chainAsThenable = chain as Chain & {
      then?: (
        resolve: (val: { error: null }) => void,
      ) => void;
    };
    chainAsThenable.then = (resolve: (val: { error: null }) => void) => {
      const target = state.buchungen.find((b) => b.id === filter.id);
      if (target && (neqStatus === null || target.status !== neqStatus)) {
        Object.assign(target, patch);
        updateSpy({ id: filter.id, patch });
      }
      resolve({ error: null });
    };
    return chain;
  }

  function fromBuchung() {
    return {
      select: vi.fn(() => makeBuchungChain()),
      update: (patch: Partial<BuchungRow>) => makeBuchungUpdate(patch),
    };
  }

  function fromAudit() {
    return {
      insert: (row: unknown) => {
        auditInsertSpy(row);
        return Promise.resolve({ error: null });
      },
    };
  }

  const from = vi.fn((tabelle: string) => {
    if (tabelle === "buchung") return fromBuchung();
    if (tabelle === "audit_eintrag") return fromAudit();
    throw new Error(`Unerwartete Tabelle im Mock: ${tabelle}`);
  });

  return { from, updateSpy, auditInsertSpy };
}

// ---------------------------------------------------------------------------
// End-to-end: wendeKonsistenzPassAn
// ---------------------------------------------------------------------------

describe("wendeKonsistenzPassAn — Pass mit Mock-Supabase", () => {
  it("3x A + 1x B → die B-Buchung wird auf A umgebogen, Audit geschrieben", async () => {
    const state: MockState = {
      buchungen: [
        row({ id: "1", empfaenger_normalisiert: "accenture", kategorie_id: "kat-a", konfidenz: 0.95 }),
        row({ id: "2", empfaenger_normalisiert: "accenture", kategorie_id: "kat-a", konfidenz: 0.9 }),
        row({ id: "3", empfaenger_normalisiert: "accenture", kategorie_id: "kat-a", konfidenz: 0.92 }),
        row({ id: "4", empfaenger_normalisiert: "accenture", kategorie_id: "kat-b", konfidenz: 0.7 }),
      ],
    };
    const { from, updateSpy, auditInsertSpy } = makeSupabase(state);
    const supabase = { from } as never;

    const r: KonsistenzPassResultat = await wendeKonsistenzPassAn(
      supabase,
      "owner-1",
    );

    expect(r.empfaenger_geprueft).toBe(1);
    expect(r.empfaenger_angepasst).toBe(1);
    expect(r.buchungen_angepasst).toBe(1);
    expect(r.empfaenger_uneinheitlich).toBe(0);
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(updateSpy.mock.calls[0][0]).toMatchObject({
      id: "4",
      patch: { kategorie_id: "kat-a", status: "auto_verbucht", pruef_grund: null },
    });
    // Audit fuer die 1 angepasste Buchung.
    expect(auditInsertSpy).toHaveBeenCalledOnce();
    const auditArg = auditInsertSpy.mock.calls[0][0] as {
      aktion: string;
      details: { vorher_kategorie_id: string; nachher_kategorie_id: string };
    };
    expect(auditArg.aktion).toBe("konsistenz_pass");
    expect(auditArg.details.vorher_kategorie_id).toBe("kat-b");
    expect(auditArg.details.nachher_kategorie_id).toBe("kat-a");
  });

  it("2x A + 2x B → KEINE Anpassung, empfaenger_uneinheitlich=1", async () => {
    const state: MockState = {
      buchungen: [
        row({ id: "1", empfaenger_normalisiert: "x", kategorie_id: "kat-a", konfidenz: 0.95 }),
        row({ id: "2", empfaenger_normalisiert: "x", kategorie_id: "kat-a", konfidenz: 0.95 }),
        row({ id: "3", empfaenger_normalisiert: "x", kategorie_id: "kat-b", konfidenz: 0.95 }),
        row({ id: "4", empfaenger_normalisiert: "x", kategorie_id: "kat-b", konfidenz: 0.95 }),
      ],
    };
    const { from, updateSpy } = makeSupabase(state);
    const supabase = { from } as never;

    const r = await wendeKonsistenzPassAn(supabase, "owner-1");
    expect(r.empfaenger_geprueft).toBe(1);
    expect(r.empfaenger_angepasst).toBe(0);
    expect(r.buchungen_angepasst).toBe(0);
    expect(r.empfaenger_uneinheitlich).toBe(1);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("3x Privat + 1x Neutral (PayPal-Pattern) → KEINE Anpassung", async () => {
    const state: MockState = {
      buchungen: [
        row({
          id: "1",
          empfaenger_normalisiert: "paypal",
          kategorie_id: "kat-priv",
          klassifikation: "privat",
          steuerrelevant: false,
          konfidenz: 0.92,
        }),
        row({
          id: "2",
          empfaenger_normalisiert: "paypal",
          kategorie_id: "kat-priv",
          klassifikation: "privat",
          steuerrelevant: false,
          konfidenz: 0.92,
        }),
        row({
          id: "3",
          empfaenger_normalisiert: "paypal",
          kategorie_id: "kat-priv",
          klassifikation: "privat",
          steuerrelevant: false,
          konfidenz: 0.92,
        }),
        row({
          id: "4",
          empfaenger_normalisiert: "paypal",
          kategorie_id: "kat-geldtransit",
          klassifikation: "neutral",
          steuerrelevant: false,
          konfidenz: 0.95,
        }),
      ],
    };
    const { from, updateSpy } = makeSupabase(state);
    const supabase = { from } as never;

    const r = await wendeKonsistenzPassAn(supabase, "owner-1");
    expect(r.empfaenger_uneinheitlich).toBe(1);
    expect(r.buchungen_angepasst).toBe(0);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("manuell_bestaetigt-Buchung wird NICHT ueberschrieben, auch wenn Mehrheit anders", async () => {
    // Status manuell_bestaetigt wird vom Pass-Query gar nicht geladen, weil
    // der `in('status', ['auto_verbucht','zur_pruefung'])` Filter sie
    // ausschliesst. Wir ueberpruefen den Schutz dennoch in einem Szenario
    // mit gemischtem Set: 3 auto, 1 manuell. Die manuelle bleibt unberuehrt
    // (weil sie gar nicht in `buchungen` landet), und der Pass tut auch
    // sonst nichts (nur 3 Buchungen, alle gleiche Kategorie → konsistent).
    const state: MockState = {
      buchungen: [
        row({ id: "1", empfaenger_normalisiert: "rene", kategorie_id: "kat-a", konfidenz: 0.95 }),
        row({ id: "2", empfaenger_normalisiert: "rene", kategorie_id: "kat-a", konfidenz: 0.95 }),
        row({ id: "3", empfaenger_normalisiert: "rene", kategorie_id: "kat-a", konfidenz: 0.95 }),
        row({
          id: "4",
          empfaenger_normalisiert: "rene",
          kategorie_id: "kat-b",
          status: "manuell_bestaetigt",
          konfidenz: 0.99,
        }),
      ],
    };
    const { from, updateSpy } = makeSupabase(state);
    const supabase = { from } as never;

    const r = await wendeKonsistenzPassAn(supabase, "owner-1");
    // manuell_bestaetigt landet gar nicht im Pass-Datensatz; die uebrigen
    // 3 Buchungen sind konsistent → kein Anpass-Bedarf.
    expect(r.buchungen_angepasst).toBe(0);
    expect(updateSpy).not.toHaveBeenCalled();
    // Die manuell_bestaetigt-Zeile bleibt physisch unveraendert.
    const m = state.buchungen.find((b) => b.id === "4");
    expect(m?.kategorie_id).toBe("kat-b");
    expect(m?.status).toBe("manuell_bestaetigt");
  });

  it("Empfaenger mit nur 2 Buchungen → komplett uebersprungen (zaehlt nicht in geprueft/uneinheitlich)", async () => {
    const state: MockState = {
      buchungen: [
        row({ id: "1", empfaenger_normalisiert: "klein", kategorie_id: "kat-a" }),
        row({ id: "2", empfaenger_normalisiert: "klein", kategorie_id: "kat-b" }),
      ],
    };
    const { from, updateSpy } = makeSupabase(state);
    const supabase = { from } as never;

    const r = await wendeKonsistenzPassAn(supabase, "owner-1");
    expect(r.empfaenger_geprueft).toBe(0);
    expect(r.empfaenger_uneinheitlich).toBe(0);
    expect(r.buchungen_angepasst).toBe(0);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("Audit-Detail enthaelt vorher/nachher + mehrheit_anzahl + gesamt_anzahl + avg_konfidenz_mehrheit", async () => {
    const state: MockState = {
      buchungen: [
        row({ id: "1", empfaenger_normalisiert: "accenture", kategorie_id: "kat-a", konfidenz: 0.95 }),
        row({ id: "2", empfaenger_normalisiert: "accenture", kategorie_id: "kat-a", konfidenz: 0.95 }),
        row({ id: "3", empfaenger_normalisiert: "accenture", kategorie_id: "kat-a", konfidenz: 0.85 }),
        row({ id: "4", empfaenger_normalisiert: "accenture", kategorie_id: "kat-x", konfidenz: 0.4 }),
      ],
    };
    const { from, auditInsertSpy } = makeSupabase(state);
    const supabase = { from } as never;

    await wendeKonsistenzPassAn(supabase, "owner-1");

    expect(auditInsertSpy).toHaveBeenCalledOnce();
    const details = (auditInsertSpy.mock.calls[0][0] as {
      details: Record<string, unknown>;
    }).details;
    expect(details.vorher_kategorie_id).toBe("kat-x");
    expect(details.nachher_kategorie_id).toBe("kat-a");
    expect(details.mehrheit_anzahl).toBe(3);
    expect(details.gesamt_anzahl).toBe(4);
    expect(details.avg_konfidenz_mehrheit).toBeGreaterThanOrEqual(0.85);
  });

  it("Buchung mit pruef_grund='ki_nicht_verfuegbar' wird mit Vorrang angepasst", async () => {
    // Hier reicht der Nachweis, dass der Pass eine `ki_nicht_verfuegbar`-
    // Buchung mit anpasst (Priorisierung schlaegt sich nur in der Reihenfolge
    // nieder, was wir nicht extra verifizieren — die Funktion erledigt es).
    const state: MockState = {
      buchungen: [
        row({ id: "1", empfaenger_normalisiert: "enercity", kategorie_id: "kat-strom", konfidenz: 0.92 }),
        row({ id: "2", empfaenger_normalisiert: "enercity", kategorie_id: "kat-strom", konfidenz: 0.92 }),
        row({ id: "3", empfaenger_normalisiert: "enercity", kategorie_id: "kat-strom", konfidenz: 0.92 }),
        row({
          id: "4",
          empfaenger_normalisiert: "enercity",
          kategorie_id: null,
          klassifikation: null,
          status: "zur_pruefung",
          konfidenz: null,
          pruef_grund: "ki_nicht_verfuegbar",
          ust_satz: null,
          steuerrelevant: null,
        }),
      ],
    };
    const { from, updateSpy } = makeSupabase(state);
    const supabase = { from } as never;

    const r = await wendeKonsistenzPassAn(supabase, "owner-1");
    expect(r.buchungen_angepasst).toBe(1);
    expect(updateSpy.mock.calls[0][0]).toMatchObject({
      id: "4",
      patch: { kategorie_id: "kat-strom", pruef_grund: null, status: "auto_verbucht" },
    });
  });
});
