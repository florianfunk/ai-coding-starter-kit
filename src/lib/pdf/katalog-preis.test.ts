import { describe, expect, it } from "vitest";
import { calcPrice } from "./katalog-document";
import type { KatalogParams, ProduktPreise } from "./katalog-document";

const PREISE: ProduktPreise = {
  listenpreis: 100,
  lichtengros: 80,
  eisenkeil: 75,
  ek: 80,
};

function params(over: Partial<KatalogParams> = {}): KatalogParams {
  return {
    layout: "lichtengros",
    preisauswahl: "listenpreis",
    preisAenderung: "plus",
    preisProzent: 0,
    waehrung: "EUR",
    wechselkurs: 1,
    sprache: "de",
    produktIds: null,
    ...over,
  };
}

describe("calcPrice", () => {
  it("Listenpreis ohne Aufschlag, EUR → unverändert", () => {
    expect(calcPrice(PREISE, params())).toBe(100);
  });

  it("Lichtengros-Spur liefert lichtengros-Preis", () => {
    expect(calcPrice(PREISE, params({ preisauswahl: "lichtengros" }))).toBe(80);
  });

  it("Eisenkeil-Spur liefert eisenkeil-Preis", () => {
    expect(calcPrice(PREISE, params({ preisauswahl: "eisenkeil" }))).toBe(75);
  });

  it("Aufschlag +20% auf Listenpreis", () => {
    expect(calcPrice(PREISE, params({ preisProzent: 20 }))).toBe(120);
  });

  it("Abschlag -10% auf Listenpreis", () => {
    expect(calcPrice(PREISE, params({ preisAenderung: "minus", preisProzent: 10 }))).toBe(90);
  });

  it("CHF mit Wechselkurs 0.95", () => {
    expect(calcPrice(PREISE, params({ waehrung: "CHF", wechselkurs: 0.95 }))).toBe(95);
  });

  it("CHF + Aufschlag: erst Faktor, dann Konversion, eine Rundung am Ende", () => {
    // 100 * 1.20 * 0.9543 = 114.516 → 114.52 (kommerzielle Rundung)
    expect(
      calcPrice(PREISE, params({ preisProzent: 20, waehrung: "CHF", wechselkurs: 0.9543 })),
    ).toBe(114.52);
  });

  it("Rundet kommerziell (half-up): 12.345 → 12.35", () => {
    // 100 * 0.12345 = 12.345 → 12.35 (Math.round half-away-from-zero)
    expect(calcPrice({ ...PREISE, listenpreis: 12.345 }, params())).toBe(12.35);
  });

  it("Negativer Endwert wird auf 0 gekappt (Aufschlag −150%)", () => {
    expect(calcPrice(PREISE, params({ preisAenderung: "minus", preisProzent: 150 }))).toBe(0);
  });

  it("Fehlender Preis in der gewählten Spur → null (auf Anfrage)", () => {
    const ohneEisenkeil: ProduktPreise = { ...PREISE, eisenkeil: null };
    expect(calcPrice(ohneEisenkeil, params({ preisauswahl: "eisenkeil" }))).toBeNull();
  });

  it("Komplett kein Preis-Datensatz → null", () => {
    expect(calcPrice(null, params())).toBeNull();
    expect(calcPrice(undefined, params())).toBeNull();
  });

  it("Backwards-Compat: alte Spur 'ek' → lichtengros-Preis", () => {
    expect(calcPrice(PREISE, params({ preisauswahl: "ek" as never }))).toBe(80);
  });

  it("Listenpreis 0 (= 'auf Anfrage' im FileMaker-Sinn) wird trotzdem gedruckt", () => {
    // 0 ist gültig — im Fachsinn evtl. „auf Anfrage", aber das interpretiert die DB
    // nicht: 0 ≠ NULL. Der Renderer druckt 0,00.
    const nullPreis: ProduktPreise = { ...PREISE, listenpreis: 0 };
    expect(calcPrice(nullPreis, params())).toBe(0);
  });
});
