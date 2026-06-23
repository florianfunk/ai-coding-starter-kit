import { describe, it, expect } from "vitest";
import {
  baueFewShotBeispiele,
  type FewShotRow,
} from "@/lib/classifier/few-shot";

function row(p: Partial<FewShotRow>): FewShotRow {
  return {
    empfaenger_normalisiert: "acme",
    empfaenger: "ACME GmbH",
    kategorie_id: "kat-1",
    klassifikation: "geschaeftlich",
    status: "auto_verbucht",
    ...p,
  };
}

describe("baueFewShotBeispiele", () => {
  it("leere Eingabe → []", () => {
    expect(baueFewShotBeispiele([])).toEqual([]);
    // @ts-expect-error — defensive Pruefung auf nicht-Array
    expect(baueFewShotBeispiele(null)).toEqual([]);
  });

  it("Mehrheitswahl pro Empfaenger (haeufigste Kombi gewinnt)", () => {
    const rows: FewShotRow[] = [
      row({ kategorie_id: "kat-a", status: "auto_verbucht" }),
      row({ kategorie_id: "kat-a", status: "auto_verbucht" }),
      row({ kategorie_id: "kat-b", status: "auto_verbucht" }),
    ];
    const out = baueFewShotBeispiele(rows);
    expect(out).toHaveLength(1);
    expect(out[0].empfaenger_norm).toBe("acme");
    expect(out[0].kategorie_id).toBe("kat-a");
  });

  it("manuell_bestaetigt zaehlt doppelt und schlaegt zwei auto-verbuchte", () => {
    const rows: FewShotRow[] = [
      // 2x auto auf kat-a (Gewicht 2)
      row({ kategorie_id: "kat-a", status: "auto_verbucht" }),
      row({ kategorie_id: "kat-a", status: "auto_verbucht" }),
      // 1x manuell auf kat-b (Gewicht 2) — Gleichstand pro Kombi, aber...
      // wir machen es eindeutig: 2x manuell auf kat-b = Gewicht 4
      row({ kategorie_id: "kat-b", status: "manuell_bestaetigt" }),
      row({ kategorie_id: "kat-b", status: "manuell_bestaetigt" }),
    ];
    const out = baueFewShotBeispiele(rows);
    expect(out).toHaveLength(1);
    expect(out[0].kategorie_id).toBe("kat-b");
  });

  it("eine manuelle (Gewicht 2) schlaegt eine auto (Gewicht 1)", () => {
    const rows: FewShotRow[] = [
      row({ kategorie_id: "kat-a", status: "auto_verbucht" }),
      row({ kategorie_id: "kat-b", status: "manuell_bestaetigt" }),
    ];
    const out = baueFewShotBeispiele(rows);
    expect(out[0].kategorie_id).toBe("kat-b");
  });

  it("Limit greift und sortiert nach Gesamt-Gewicht DESC", () => {
    const rows: FewShotRow[] = [
      // emp1: Gewicht 1
      row({ empfaenger_normalisiert: "emp1", kategorie_id: "k1" }),
      // emp2: Gewicht 3 (3 auto)
      row({ empfaenger_normalisiert: "emp2", kategorie_id: "k2" }),
      row({ empfaenger_normalisiert: "emp2", kategorie_id: "k2" }),
      row({ empfaenger_normalisiert: "emp2", kategorie_id: "k2" }),
      // emp3: Gewicht 2 (1 manuell)
      row({
        empfaenger_normalisiert: "emp3",
        kategorie_id: "k3",
        status: "manuell_bestaetigt",
      }),
    ];
    const out = baueFewShotBeispiele(rows, { limit: 2 });
    expect(out).toHaveLength(2);
    expect(out[0].empfaenger_norm).toBe("emp2"); // 3
    expect(out[1].empfaenger_norm).toBe("emp3"); // 2
  });

  it("Tie-Break stabil alphabetisch nach empfaenger_norm", () => {
    const rows: FewShotRow[] = [
      row({ empfaenger_normalisiert: "zebra", kategorie_id: "k1" }),
      row({ empfaenger_normalisiert: "alpha", kategorie_id: "k2" }),
    ];
    const out = baueFewShotBeispiele(rows);
    expect(out.map((b) => b.empfaenger_norm)).toEqual(["alpha", "zebra"]);
  });

  it("Familienausschluss (Set) entfernt Empfaenger", () => {
    const rows: FewShotRow[] = [
      row({ empfaenger_normalisiert: "max mustermann", kategorie_id: "k1" }),
      row({ empfaenger_normalisiert: "acme", kategorie_id: "k2" }),
    ];
    const out = baueFewShotBeispiele(rows, {
      familie_norm: new Set(["Max Mustermann".toLowerCase()]),
    });
    expect(out.map((b) => b.empfaenger_norm)).toEqual(["acme"]);
  });

  it("Familienausschluss (Array) funktioniert ebenfalls", () => {
    const rows: FewShotRow[] = [
      row({ empfaenger_normalisiert: "anna schmidt", kategorie_id: "k1" }),
      row({ empfaenger_normalisiert: "acme", kategorie_id: "k2" }),
    ];
    const out = baueFewShotBeispiele(rows, {
      familie_norm: ["anna schmidt"],
    });
    expect(out.map((b) => b.empfaenger_norm)).toEqual(["acme"]);
  });

  it("Empfaenger ohne kategorie_id wird uebersprungen", () => {
    const rows: FewShotRow[] = [
      row({ empfaenger_normalisiert: "emp1", kategorie_id: null }),
      row({ empfaenger_normalisiert: "emp2", kategorie_id: "k2" }),
    ];
    const out = baueFewShotBeispiele(rows);
    expect(out.map((b) => b.empfaenger_norm)).toEqual(["emp2"]);
  });

  it("Zeile ohne klassifikation wird uebersprungen", () => {
    const rows: FewShotRow[] = [
      row({ empfaenger_normalisiert: "emp1", klassifikation: null }),
    ];
    expect(baueFewShotBeispiele(rows)).toEqual([]);
  });

  it("leerer/whitespace empfaenger_norm wird ignoriert", () => {
    const rows: FewShotRow[] = [
      row({ empfaenger_normalisiert: "   " }),
      row({ empfaenger_normalisiert: null }),
    ];
    expect(baueFewShotBeispiele(rows)).toEqual([]);
  });

  it("uebernimmt rohwert und klassifikation der besten Kombi", () => {
    const rows: FewShotRow[] = [
      row({
        empfaenger_normalisiert: "acme",
        empfaenger: "ACME GmbH",
        kategorie_id: "kat-x",
        klassifikation: "geschaeftlich",
        status: "manuell_bestaetigt",
      }),
    ];
    const out = baueFewShotBeispiele(rows);
    expect(out[0]).toMatchObject({
      empfaenger_norm: "acme",
      rohwert: "ACME GmbH",
      kategorie_id: "kat-x",
      klassifikation: "geschaeftlich",
    });
  });

  it("limit <= 0 → []", () => {
    const rows: FewShotRow[] = [row({})];
    expect(baueFewShotBeispiele(rows, { limit: 0 })).toEqual([]);
  });
});
