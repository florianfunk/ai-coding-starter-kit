import { describe, expect, it } from "vitest";
import { normalizeParams } from "./route";

describe("normalizeParams", () => {
  it("akzeptiert vollständige Wizard-Parameter", () => {
    const out = normalizeParams({
      layout: "lichtengros",
      preisauswahl: "eisenkeil",
      preisAenderung: "minus",
      preisProzent: 12.5,
      waehrung: "CHF",
      wechselkurs: 0.95,
      sprache: "de",
      produktIds: ["a", "b"],
    });
    expect(out.layout).toBe("lichtengros");
    expect(out.preisauswahl).toBe("eisenkeil");
    expect(out.preisAenderung).toBe("minus");
    expect(out.preisProzent).toBe(12.5);
    expect(out.waehrung).toBe("CHF");
    expect(out.wechselkurs).toBe(0.95);
    expect(out.produktIds).toEqual(["a", "b"]);
  });

  it("Backwards-Compat: alte Spur 'ek' → 'lichtengros'", () => {
    const logs: string[] = [];
    const out = normalizeParams(
      { layout: "eisenkeil", preisauswahl: "ek", preisAenderung: "plus", preisProzent: 0, waehrung: "EUR", wechselkurs: 1 },
      (msg) => logs.push(msg),
    );
    expect(out.preisauswahl).toBe("lichtengros");
    expect(logs.some((l) => /Backwards-Compat/i.test(l))).toBe(true);
  });

  it("Unbekannte Spur → fallback 'listenpreis' mit Log-Warnung", () => {
    const logs: string[] = [];
    const out = normalizeParams(
      { layout: "lichtengros", preisauswahl: "unsinn", preisAenderung: "plus", preisProzent: 0, waehrung: "EUR", wechselkurs: 1 },
      (msg) => logs.push(msg),
    );
    expect(out.preisauswahl).toBe("listenpreis");
    expect(logs.some((l) => /Unbekannte Preisspur/i.test(l))).toBe(true);
  });

  it("Defaults: fehlende Felder werden gefüllt", () => {
    const out = normalizeParams({ layout: "lichtengros" });
    expect(out.preisauswahl).toBe("listenpreis");
    expect(out.preisAenderung).toBe("plus");
    expect(out.preisProzent).toBe(0);
    expect(out.waehrung).toBe("EUR");
    expect(out.wechselkurs).toBe(1);
    expect(out.sprache).toBe("de");
    expect(out.produktIds).toBeNull();
  });

  it("Leere produktIds-Array wird zu null (= alles)", () => {
    const out = normalizeParams({ layout: "lichtengros", produktIds: [] });
    expect(out.produktIds).toBeNull();
  });

  it("produktIds filtert Nicht-Strings raus", () => {
    const out = normalizeParams({ layout: "lichtengros", produktIds: ["a", 123, null, "b"] });
    expect(out.produktIds).toEqual(["a", "b"]);
  });

  it("ungültiges Layout wirft sprechenden Fehler", () => {
    expect(() => normalizeParams({ layout: "unbekannt" })).toThrow(/Layout/i);
    expect(() => normalizeParams({})).toThrow(/Layout/i);
  });

  it("nicht-Objekt wirft sprechenden Fehler", () => {
    expect(() => normalizeParams(null)).toThrow(/parameter/i);
    expect(() => normalizeParams("string")).toThrow(/parameter/i);
  });

  it("Wechselkurs ≤ 0 oder NaN → Default 1", () => {
    expect(normalizeParams({ layout: "lichtengros", wechselkurs: 0 }).wechselkurs).toBe(1);
    expect(normalizeParams({ layout: "lichtengros", wechselkurs: -1 }).wechselkurs).toBe(1);
    expect(normalizeParams({ layout: "lichtengros", wechselkurs: "abc" }).wechselkurs).toBe(1);
  });

  it("Vorzeichen 'minus' wird übernommen, alles andere → 'plus'", () => {
    expect(normalizeParams({ layout: "lichtengros", preisAenderung: "minus" }).preisAenderung).toBe("minus");
    expect(normalizeParams({ layout: "lichtengros", preisAenderung: "blub" }).preisAenderung).toBe("plus");
  });

  it("Währung 'CHF' wird übernommen, alles andere → 'EUR'", () => {
    expect(normalizeParams({ layout: "lichtengros", waehrung: "CHF" }).waehrung).toBe("CHF");
    expect(normalizeParams({ layout: "lichtengros", waehrung: "USD" }).waehrung).toBe("EUR");
  });
});
