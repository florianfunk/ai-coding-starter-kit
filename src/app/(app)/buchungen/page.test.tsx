import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  queries: [] as {
    filters: [string, string, unknown][];
    orders: string[];
    range?: [number, number];
  }[],
  failFrom: Infinity,
}));

vi.mock("@/lib/auth/guard", () => ({
  requireUser: async () => ({ id: "owner-test" }),
}));
vi.mock("@/lib/jahr/aktives-jahr", () => ({
  aktiverZeitraum: async () => ({ von: "2025-01-01", bis: "2025-12-31" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const request = { filters: [], orders: [] } as (typeof db.queries)[number];
      if (table === "buchung") db.queries.push(request);
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => {
          request.filters.push(["eq", field, value]);
          return query;
        },
        gte: (field: string, value: unknown) => {
          request.filters.push(["gte", field, value]);
          return query;
        },
        lte: (field: string, value: unknown) => {
          request.filters.push(["lte", field, value]);
          return query;
        },
        order: (field: string) => {
          request.orders.push(field);
          return query;
        },
        limit: () => query,
        range: (from: number, to: number) => {
          request.range = [from, to];
          return query;
        },
        then: (resolve: (result: unknown) => unknown) => {
          const [from, to] = request.range ?? [0, 999];
          if (table === "buchung" && from >= db.failFrom) {
            return Promise.resolve({ data: null, error: { message: "offline" } }).then(resolve);
          }
          const rows = table === "buchung" ? db.rows.filter((row) =>
            request.filters.every(([op, field, value]) => {
              if (op === "eq") return row[field] === value;
              if (op === "gte") return String(row[field]) >= String(value);
              return String(row[field]) <= String(value);
            }),
          ) : [];
          // Simuliert das serverseitige Maximum von 1000 Zeilen pro Antwort.
          return Promise.resolve({
            data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null,
          }).then(resolve);
        },
      };
      return query;
    },
  }),
}));

import BuchungenPage from "./page";
import { BuchungenLedger } from "@/components/buchungen/buchungen-ledger";

function content(element: ReactElement) {
  return (element.props as { children: ReactElement }).children;
}

describe("BuchungenPage: vollständige Filtergrundlage", () => {
  beforeEach(() => {
    db.rows = Array.from({ length: 6025 }, (_, i) => ({
      id: `booking-${i}`,
      owner_id: "owner-test",
      konto_id: "konto-test",
      buchung_datum: "2025-06-01",
      empfaenger: i % 700 === 0 ? "Suchfirma" : "Anderer Empfänger",
      betrag: 100,
    }));
    db.queries = [];
    db.failFrom = Infinity;
  });

  it("liefert auch ältere Suchtreffer und Summen jenseits von 1000 und 5000 Zeilen", async () => {
    const result = content(await BuchungenPage({ searchParams: Promise.resolve({ q: "suchfirma" }) }));
    expect(result.type).toBe(BuchungenLedger);
    const { buchungen, filter } = result.props as {
      buchungen: typeof db.rows; filter: { q: string };
    };
    expect(buchungen).toHaveLength(6025);
    const treffer = buchungen.filter((b) => String(b.empfaenger).toLowerCase().includes(filter.q));
    expect(treffer).toHaveLength(9);
    expect(treffer.reduce((sum, b) => sum + Number(b.betrag), 0)).toBe(900);
    expect(db.queries).toHaveLength(7);
    for (const query of db.queries) {
      expect(query.orders).toEqual(["buchung_datum", "id"]);
      expect(query.filters).toEqual([
        ["eq", "owner_id", "owner-test"],
        ["gte", "buchung_datum", "2025-01-01"],
        ["lte", "buchung_datum", "2025-12-31"],
      ]);
    }
  });

  it("wendet Konto, Jahresgrenzen und Eigentümer auf jeder Seite an", async () => {
    db.rows.push(
      { ...db.rows[0], id: "fremd", owner_id: "other-owner" },
      { ...db.rows[0], id: "anderes-konto", konto_id: "konto-other" },
      { ...db.rows[0], id: "vorjahr", buchung_datum: "2024-12-31" },
      { ...db.rows[0], id: "folgejahr", buchung_datum: "2026-01-01" },
    );
    const result = content(await BuchungenPage({ searchParams: Promise.resolve({ konto: "konto-test" }) }));
    const { buchungen } = result.props as { buchungen: typeof db.rows };
    expect(buchungen).toHaveLength(6025);
    for (const query of db.queries) {
      expect(query.filters).toContainEqual(["eq", "konto_id", "konto-test"]);
    }
  });

  it("zeigt bei einem Fehler auf einer späteren Seite keine unvollständige Buchungsliste", async () => {
    db.failFrom = 1000;
    const result = content(await BuchungenPage({ searchParams: Promise.resolve({}) }));
    expect(result.type).not.toBe(BuchungenLedger);
    expect(db.queries).toHaveLength(2);
  });
});
