import { describe, expect, it } from "vitest";
import {
  clampZeitraum,
  jahrZuZeitraum,
  parseJahrParam,
  verfuegbareJahre,
} from "./aktives-jahr";

describe("jahrZuZeitraum", () => {
  it("liefert das Kalenderjahr-Fenster für ein Jahr", () => {
    expect(jahrZuZeitraum(2025)).toEqual({ von: "2025-01-01", bis: "2025-12-31" });
  });
  it("liefert unbegrenzt für null (Alle Jahre)", () => {
    expect(jahrZuZeitraum(null)).toEqual({ von: null, bis: null });
  });
});

describe("clampZeitraum", () => {
  it("lässt das Fenster bei Alle Jahre unverändert", () => {
    const f = { von: "2020-01-01", bis: "2026-12-31" };
    expect(clampZeitraum(f, null)).toEqual(f);
  });
  it("klammert ein zu weites Fenster auf das Jahr", () => {
    expect(
      clampZeitraum({ von: "2020-01-01", bis: "2030-12-31" }, 2025),
    ).toEqual({ von: "2025-01-01", bis: "2025-12-31" });
  });
  it("behält ein Teilfenster innerhalb des Jahres", () => {
    expect(
      clampZeitraum({ von: "2025-03-01", bis: "2025-06-30" }, 2025),
    ).toEqual({ von: "2025-03-01", bis: "2025-06-30" });
  });
  it("füllt offene Grenzen mit dem Jahresrand", () => {
    expect(clampZeitraum({ von: null, bis: null }, 2025)).toEqual({
      von: "2025-01-01",
      bis: "2025-12-31",
    });
    expect(clampZeitraum({ von: "2025-05-01", bis: null }, 2025)).toEqual({
      von: "2025-05-01",
      bis: "2025-12-31",
    });
  });
  it("fällt bei leerer Schnittmenge auf das ganze Jahr zurück", () => {
    // Fenster liegt komplett in 2024, aktiv ist 2025 → ganzes 2025.
    expect(
      clampZeitraum({ von: "2024-01-01", bis: "2024-12-31" }, 2025),
    ).toEqual({ von: "2025-01-01", bis: "2025-12-31" });
  });
});

describe("verfuegbareJahre", () => {
  it("absteigend vom Datenbereich inkl. aktuellem Jahr", () => {
    expect(verfuegbareJahre("2023-04-01", "2025-11-30", 2026)).toEqual([
      2026, 2025, 2024, 2023,
    ]);
  });
  it("nur aktuelles Jahr ohne Daten", () => {
    expect(verfuegbareJahre(null, null, 2026)).toEqual([2026]);
  });
  it("schließt das aktuelle Jahr ein, auch wenn Daten älter sind", () => {
    expect(verfuegbareJahre("2022-01-01", "2023-12-31", 2026)).toEqual([
      2026, 2025, 2024, 2023, 2022,
    ]);
  });
  it("schließt frühere Jahre ein, wenn das aktuelle Jahr früher liegt", () => {
    expect(verfuegbareJahre("2024-01-01", "2025-12-31", 2024)).toEqual([
      2025, 2024,
    ]);
  });
});

describe("parseJahrParam", () => {
  it("parst eine gültige Jahreszahl", () => {
    expect(parseJahrParam("2025")).toBe(2025);
  });
  it("behandelt 'alle' und leer als null", () => {
    expect(parseJahrParam("alle")).toBeNull();
    expect(parseJahrParam("")).toBeNull();
    expect(parseJahrParam(null)).toBeNull();
    expect(parseJahrParam(undefined)).toBeNull();
  });
  it("weist Unsinn/Out-of-range ab", () => {
    expect(parseJahrParam("99")).toBeNull();
    expect(parseJahrParam("1999")).toBeNull();
    expect(parseJahrParam("abcd")).toBeNull();
  });
});
