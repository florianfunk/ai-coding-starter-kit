import { describe, it, expect } from "vitest";
import { kategorieInputSchema } from "./kontenrahmen";

describe("kategorieInputSchema – Pflichtfelder", () => {
  it("akzeptiert eine gültige Einnahme-Kategorie", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "Erlöse 19% USt",
      typ: "einnahme",
      ust_satz: 19,
      euer_zeile: "14",
      elster_kennzahl: "81",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aktiv).toBe(true); // default
      expect(result.data.gueltig_ab).toBeNull(); // default null
    }
  });

  it("lehnt zu kurze Bezeichnung ab", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "A",
      typ: "ausgabe",
      ust_satz: 19,
    });
    expect(result.success).toBe(false);
  });

  it("lehnt ungültigen Typ ab", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "Test",
      typ: "spende",
      ust_satz: 19,
    });
    expect(result.success).toBe(false);
  });

  it("lehnt ungültiges Datumsformat ab", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "Bürobedarf",
      typ: "ausgabe",
      ust_satz: 19,
      gueltig_ab: "15.05.2026",
    });
    expect(result.success).toBe(false);
  });

  it("normalisiert leere optionale Strings zu null", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "Bürobedarf",
      typ: "ausgabe",
      ust_satz: 19,
      euer_zeile: "",
      elster_kennzahl: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.euer_zeile).toBeNull();
      expect(result.data.elster_kennzahl).toBeNull();
    }
  });
});

describe("kategorieInputSchema – Konsistenzregel USt-Satz/Typ", () => {
  it("akzeptiert privat OHNE USt-Satz", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "Privatentnahme",
      typ: "privat",
      ust_satz: null,
    });
    expect(result.success).toBe(true);
  });

  it("akzeptiert neutral OHNE USt-Satz", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "Geldtransit",
      typ: "neutral",
      ust_satz: null,
    });
    expect(result.success).toBe(true);
  });

  it("lehnt privat MIT USt-Satz ab", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "Privatentnahme",
      typ: "privat",
      ust_satz: 19,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["ust_satz"]);
    }
  });

  it("lehnt neutral MIT USt-Satz ab", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "USt-Zahllast",
      typ: "neutral",
      ust_satz: 7,
    });
    expect(result.success).toBe(false);
  });

  it("lehnt einnahme OHNE USt-Satz ab", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "Erlöse",
      typ: "einnahme",
      ust_satz: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["ust_satz"]);
    }
  });

  it("lehnt ausgabe OHNE USt-Satz ab", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "Wareneinkauf",
      typ: "ausgabe",
      ust_satz: null,
    });
    expect(result.success).toBe(false);
  });

  it("akzeptiert ausgabe mit 0% (steuerfrei)", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "Versicherungen (steuerfrei)",
      typ: "ausgabe",
      ust_satz: 0,
    });
    expect(result.success).toBe(true);
  });

  it("lehnt ungültigen USt-Satz (z.B. 16) ab", () => {
    const result = kategorieInputSchema.safeParse({
      bezeichnung: "Alt-Satz",
      typ: "ausgabe",
      ust_satz: 16,
    });
    expect(result.success).toBe(false);
  });
});
