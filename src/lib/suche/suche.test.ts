// PROJ-34: Unit-Tests für die reinen Such-Helfer.

import { describe, it, expect } from "vitest";
import {
  normalisiereQuery,
  istSuchbar,
  erkenneBetrag,
  ilikePattern,
  ilikeOrWert,
  mapeBuchung,
  aggregiereEmpfaenger,
  leereAntwort,
  MIN_QUERY_LEN,
  SUCHE_LIMIT,
} from "./suche";

describe("normalisiereQuery", () => {
  it("trimmt Whitespace", () => {
    expect(normalisiereQuery("  rewe  ")).toBe("rewe");
  });
  it("behandelt null/undefined als leeren String", () => {
    expect(normalisiereQuery(null)).toBe("");
    expect(normalisiereQuery(undefined)).toBe("");
  });
  it("kappt überlange Eingaben auf 100 Zeichen", () => {
    const lang = "x".repeat(250);
    expect(normalisiereQuery(lang)).toHaveLength(100);
  });
});

describe("istSuchbar", () => {
  it("false unter Mindestlänge", () => {
    expect(istSuchbar("")).toBe(false);
    expect(istSuchbar("a")).toBe(false);
  });
  it("true ab Mindestlänge", () => {
    expect(istSuchbar("ab")).toBe(true);
    expect(istSuchbar("rewe")).toBe(true);
  });
  it("Mindestlänge ist 2", () => {
    expect(MIN_QUERY_LEN).toBe(2);
  });
});

describe("erkenneBetrag", () => {
  it("erkennt einfache Ganzzahl", () => {
    expect(erkenneBetrag("100")).toBe(100);
  });
  it("erkennt deutsche Dezimalzahl", () => {
    expect(erkenneBetrag("12,90")).toBeCloseTo(12.9);
  });
  it("erkennt englische Dezimalzahl", () => {
    expect(erkenneBetrag("12.90")).toBeCloseTo(12.9);
  });
  it("erkennt deutsches Tausender-Format", () => {
    expect(erkenneBetrag("1.234,56")).toBeCloseTo(1234.56);
  });
  it("erkennt englisches Tausender-Format", () => {
    expect(erkenneBetrag("1,234.56")).toBeCloseTo(1234.56);
  });
  it("erkennt negative Beträge", () => {
    expect(erkenneBetrag("-50")).toBe(-50);
    expect(erkenneBetrag("-12,90")).toBeCloseTo(-12.9);
  });
  it("liefert null für reinen Text", () => {
    expect(erkenneBetrag("rewe")).toBeNull();
    expect(erkenneBetrag("amazon 100")).toBeNull();
  });
  it("liefert null für leere Eingabe", () => {
    expect(erkenneBetrag("")).toBeNull();
    expect(erkenneBetrag("   ")).toBeNull();
  });
  it("liefert null für nur Trennzeichen", () => {
    expect(erkenneBetrag(",")).toBeNull();
    expect(erkenneBetrag(".")).toBeNull();
  });
});

describe("ilikePattern", () => {
  it("umschließt mit %", () => {
    expect(ilikePattern("rewe")).toBe("%rewe%");
  });
  it("escapt LIKE-Wildcards", () => {
    expect(ilikePattern("50%")).toBe("%50\\%%");
    expect(ilikePattern("a_b")).toBe("%a\\_b%");
  });
  it("escapt Backslash", () => {
    expect(ilikePattern("a\\b")).toBe("%a\\\\b%");
  });
});

describe("ilikeOrWert", () => {
  it("quotiert den Pattern-Wert für PostgREST .or()", () => {
    expect(ilikeOrWert("rewe")).toBe('"%rewe%"');
  });
  it("schützt ein Komma im Suchbegriff (QA-W1)", () => {
    // Ohne Quoting würde das Komma die .or()-Bedingung zerbrechen.
    expect(ilikeOrWert("a,b")).toBe('"%a,b%"');
  });
  it("verdoppelt enthaltene Anführungszeichen", () => {
    expect(ilikeOrWert('a"b')).toBe('"%a""b%"');
  });
});

describe("mapeBuchung", () => {
  it("mappt eine vollständige Row", () => {
    const dto = mapeBuchung({
      id: "abc",
      buchung_datum: "2026-01-15",
      betrag: -12.9,
      empfaenger: "REWE",
      verwendungszweck: "Einkauf",
    });
    expect(dto).toEqual({
      id: "abc",
      buchung_datum: "2026-01-15",
      betrag: -12.9,
      empfaenger: "REWE",
      verwendungszweck: "Einkauf",
    });
  });
  it("wandelt String-Betrag in Zahl", () => {
    const dto = mapeBuchung({
      id: "x",
      buchung_datum: "2026-01-01",
      betrag: "99.50",
      empfaenger: null,
      verwendungszweck: null,
    });
    expect(dto.betrag).toBeCloseTo(99.5);
  });
  it("fängt null/NaN-Betrag auf 0 ab", () => {
    const dto = mapeBuchung({
      id: "x",
      buchung_datum: "2026-01-01",
      betrag: null,
      empfaenger: null,
      verwendungszweck: null,
    });
    expect(dto.betrag).toBe(0);
  });
});

describe("aggregiereEmpfaenger", () => {
  it("dedupliziert nach normalisiertem Wert und zählt", () => {
    const out = aggregiereEmpfaenger([
      { empfaenger: "REWE Markt", empfaenger_normalisiert: "rewe" },
      { empfaenger: "Rewe", empfaenger_normalisiert: "rewe" },
      { empfaenger: "Amazon EU", empfaenger_normalisiert: "amazon" },
    ]);
    expect(out).toHaveLength(2);
    const rewe = out.find((e) => e.normalisiert === "rewe");
    expect(rewe?.anzahl).toBe(2);
    expect(rewe?.name).toBe("REWE Markt");
  });
  it("sortiert nach Häufigkeit absteigend", () => {
    const out = aggregiereEmpfaenger([
      { empfaenger: "A", empfaenger_normalisiert: "a" },
      { empfaenger: "B", empfaenger_normalisiert: "b" },
      { empfaenger: "B", empfaenger_normalisiert: "b" },
    ]);
    expect(out[0]?.normalisiert).toBe("b");
  });
  it("überspringt Rows ohne normalisierten Wert", () => {
    const out = aggregiereEmpfaenger([
      { empfaenger: "Leer", empfaenger_normalisiert: "" },
      { empfaenger: "Leer2", empfaenger_normalisiert: null },
      { empfaenger: "Echt", empfaenger_normalisiert: "echt" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.normalisiert).toBe("echt");
  });
  it("nutzt normalisierten Wert als Namen-Fallback", () => {
    const out = aggregiereEmpfaenger([
      { empfaenger: null, empfaenger_normalisiert: "nurnorm" },
    ]);
    expect(out[0]?.name).toBe("nurnorm");
  });
  it("kappt auf das Limit", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      empfaenger: `E${i}`,
      empfaenger_normalisiert: `e${i}`,
    }));
    expect(aggregiereEmpfaenger(rows, 5)).toHaveLength(5);
    expect(aggregiereEmpfaenger(rows)).toHaveLength(SUCHE_LIMIT);
  });
});

describe("leereAntwort", () => {
  it("liefert leere Arrays", () => {
    expect(leereAntwort()).toEqual({ buchungen: [], empfaenger: [] });
  });
});
