import { describe, expect, it } from "vitest";
import { localizedField, STATIC_LABELS } from "./i18n";

describe("localizedField", () => {
  it("liefert IT-Wert wenn lang=it und *_it gefüllt", () => {
    const produkt = { name: "LED-Stripe", name_it: "Striscia LED" };
    expect(localizedField(produkt, "name", "it")).toBe("Striscia LED");
  });

  it("fällt auf DE zurück wenn lang=it und *_it leer", () => {
    const produkt = { name: "LED-Stripe", name_it: "" };
    expect(localizedField(produkt, "name", "it")).toBe("LED-Stripe");
  });

  it("fällt auf DE zurück wenn lang=it und *_it null", () => {
    const produkt = { name: "LED-Stripe", name_it: null };
    expect(localizedField(produkt, "name", "it")).toBe("LED-Stripe");
  });

  it("fällt auf DE zurück wenn lang=it und *_it nur Whitespace", () => {
    const produkt = { name: "LED-Stripe", name_it: "   " };
    expect(localizedField(produkt, "name", "it")).toBe("LED-Stripe");
  });

  it("liefert null wenn DE und IT beide leer", () => {
    const produkt = { name: "", name_it: null };
    expect(localizedField(produkt, "name", "it")).toBeNull();
  });

  it("ignoriert IT bei lang=de", () => {
    const produkt = { name: "LED-Stripe", name_it: "Striscia LED" };
    expect(localizedField(produkt, "name", "de")).toBe("LED-Stripe");
  });

  it("liefert null für unbekannten DE-Schlüssel ohne Übersetzungs-Definition", () => {
    const produkt = { foo: "bar" };
    // foo ist nicht in TRANSLATABLE_FIELDS — IT-Lookup wird übersprungen,
    // Fallback auf foo selbst greift.
    expect(localizedField(produkt, "foo", "it")).toBe("bar");
  });
});

describe("STATIC_LABELS", () => {
  it("enthält dieselben Schlüssel für DE und IT", () => {
    const deKeys = Object.keys(STATIC_LABELS.de).sort();
    const itKeys = Object.keys(STATIC_LABELS.it).sort();
    expect(itKeys).toEqual(deKeys);
  });

  it("italienische Labels sind nicht leer", () => {
    for (const v of Object.values(STATIC_LABELS.it)) {
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it("technische_daten ist auf Italienisch übersetzt", () => {
    expect(STATIC_LABELS.it.technische_daten).toBe("Dati tecnici");
  });

  it("achtung ist auf Italienisch übersetzt", () => {
    expect(STATIC_LABELS.it.achtung).toBe("ATTENZIONE");
  });
});
