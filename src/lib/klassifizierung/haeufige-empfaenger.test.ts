import { describe, expect, it } from "vitest";
import {
  aggregiereHaeufigeEmpfaenger,
  type PrueflistenZeile,
} from "./haeufige-empfaenger";

function z(over: Partial<PrueflistenZeile>): PrueflistenZeile {
  return {
    empfaenger_normalisiert: "acme",
    empfaenger: "ACME GmbH",
    betrag: -10,
    buchung_datum: "2025-03-01",
    pruef_grund: "konfidenz_niedrig",
    ...over,
  };
}

describe("aggregiereHaeufigeEmpfaenger", () => {
  it("gruppiert nach empfaenger_normalisiert und zählt", () => {
    const r = aggregiereHaeufigeEmpfaenger([
      z({ empfaenger_normalisiert: "acme", betrag: -10 }),
      z({ empfaenger_normalisiert: "acme", betrag: -20 }),
      z({ empfaenger_normalisiert: "globex", betrag: -5 }),
    ]);
    expect(r).toHaveLength(2);
    const acme = r.find((g) => g.empfaenger_norm === "acme")!;
    expect(acme.anzahl).toBe(2);
    const globex = r.find((g) => g.empfaenger_norm === "globex")!;
    expect(globex.anzahl).toBe(1);
  });

  it("liefert summe, durchschnitt (Absolutbeträge) und beispiel-rohwert", () => {
    const r = aggregiereHaeufigeEmpfaenger([
      z({
        empfaenger_normalisiert: "acme",
        empfaenger: "ACME GmbH",
        betrag: -10,
      }),
      z({
        empfaenger_normalisiert: "acme",
        empfaenger: "ACME GmbH Berlin",
        betrag: -30,
      }),
    ]);
    const acme = r[0];
    expect(acme.summe).toBe(40);
    expect(acme.durchschnitt).toBe(20);
    expect(acme.beispiel_rohwert).toBe("ACME GmbH");
  });

  it("ermittelt das jüngste Datum (letzte)", () => {
    const r = aggregiereHaeufigeEmpfaenger([
      z({ empfaenger_normalisiert: "acme", buchung_datum: "2025-01-01" }),
      z({ empfaenger_normalisiert: "acme", buchung_datum: "2025-06-15" }),
      z({ empfaenger_normalisiert: "acme", buchung_datum: "2025-03-09" }),
    ]);
    expect(r[0].letzte).toBe("2025-06-15");
  });

  it("sortiert absteigend nach Anzahl (häufigste zuerst)", () => {
    const r = aggregiereHaeufigeEmpfaenger([
      z({ empfaenger_normalisiert: "selten" }),
      z({ empfaenger_normalisiert: "haeufig" }),
      z({ empfaenger_normalisiert: "haeufig" }),
      z({ empfaenger_normalisiert: "haeufig" }),
      z({ empfaenger_normalisiert: "mittel" }),
      z({ empfaenger_normalisiert: "mittel" }),
    ]);
    expect(r.map((g) => g.empfaenger_norm)).toEqual([
      "haeufig",
      "mittel",
      "selten",
    ]);
  });

  it("ignoriert Zeilen ohne normalisierten Empfänger", () => {
    const r = aggregiereHaeufigeEmpfaenger([
      z({ empfaenger_normalisiert: null }),
      z({ empfaenger_normalisiert: "" }),
      z({ empfaenger_normalisiert: "  " }),
      z({ empfaenger_normalisiert: "acme" }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].empfaenger_norm).toBe("acme");
  });

  it("sammelt die distinct pruef_gruende je Empfänger", () => {
    const r = aggregiereHaeufigeEmpfaenger([
      z({ empfaenger_normalisiert: "acme", pruef_grund: "konfidenz_niedrig" }),
      z({ empfaenger_normalisiert: "acme", pruef_grund: "ki_nicht_verfuegbar" }),
      z({ empfaenger_normalisiert: "acme", pruef_grund: "konfidenz_niedrig" }),
    ]);
    expect(r[0].pruef_gruende.sort()).toEqual([
      "ki_nicht_verfuegbar",
      "konfidenz_niedrig",
    ]);
  });

  it("zerlegt kommaseparierte pruef_gruende in einzelne Gründe", () => {
    const r = aggregiereHaeufigeEmpfaenger([
      z({
        empfaenger_normalisiert: "acme",
        pruef_grund: "konfidenz_niedrig, betrag_ausreisser",
      }),
    ]);
    expect(r[0].pruef_gruende.sort()).toEqual([
      "betrag_ausreisser",
      "konfidenz_niedrig",
    ]);
  });

  it("respektiert min_anzahl (Default 1) — filtert Einzelfälle bei min_anzahl=2", () => {
    const r = aggregiereHaeufigeEmpfaenger(
      [
        z({ empfaenger_normalisiert: "einzeln" }),
        z({ empfaenger_normalisiert: "doppelt" }),
        z({ empfaenger_normalisiert: "doppelt" }),
      ],
      { min_anzahl: 2 },
    );
    expect(r).toHaveLength(1);
    expect(r[0].empfaenger_norm).toBe("doppelt");
  });

  it("kappt das Ergebnis bei limit (häufigste behalten)", () => {
    const r = aggregiereHaeufigeEmpfaenger(
      [
        z({ empfaenger_normalisiert: "a" }),
        z({ empfaenger_normalisiert: "a" }),
        z({ empfaenger_normalisiert: "a" }),
        z({ empfaenger_normalisiert: "b" }),
        z({ empfaenger_normalisiert: "b" }),
        z({ empfaenger_normalisiert: "c" }),
      ],
      { limit: 2 },
    );
    expect(r.map((g) => g.empfaenger_norm)).toEqual(["a", "b"]);
  });

  it("rundet summe und durchschnitt auf 2 Nachkommastellen", () => {
    const r = aggregiereHaeufigeEmpfaenger([
      z({ empfaenger_normalisiert: "acme", betrag: -3.333 }),
      z({ empfaenger_normalisiert: "acme", betrag: -3.333 }),
      z({ empfaenger_normalisiert: "acme", betrag: -3.334 }),
    ]);
    expect(r[0].summe).toBe(10);
    expect(r[0].durchschnitt).toBe(3.33);
  });

  it("liefert für leere Eingabe ein leeres Array", () => {
    expect(aggregiereHaeufigeEmpfaenger([])).toEqual([]);
  });
});
