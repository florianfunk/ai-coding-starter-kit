import { describe, it, expect } from "vitest";
import {
  kontoInputSchema,
  kontoMappingSchema,
  importRequestSchema,
} from "./konto";

describe("kontoInputSchema", () => {
  it("akzeptiert ein gültiges Bankkonto ohne Mapping", () => {
    const r = kontoInputSchema.safeParse({
      bezeichnung: "Geschäftskonto",
      typ: "bank",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mapping).toBeNull();
  });

  it("akzeptiert alle erlaubten Kontotypen", () => {
    for (const typ of ["bank", "paypal", "kreditkarte"] as const) {
      expect(
        kontoInputSchema.safeParse({ bezeichnung: "Konto X", typ }).success,
      ).toBe(true);
    }
  });

  it("lehnt unbekannten Kontotyp ab", () => {
    const r = kontoInputSchema.safeParse({
      bezeichnung: "Sparbuch",
      typ: "tagesgeld",
    });
    expect(r.success).toBe(false);
  });

  it("lehnt zu kurze Bezeichnung ab", () => {
    const r = kontoInputSchema.safeParse({ bezeichnung: "A", typ: "bank" });
    expect(r.success).toBe(false);
  });

  it("akzeptiert ein Konto mit vollständigem Mapping", () => {
    const r = kontoInputSchema.safeParse({
      bezeichnung: "Kreditkarte 1",
      typ: "kreditkarte",
      mapping: {
        datum: "Belegdatum",
        betrag: "Betrag",
        verwendungszweck: "Beschreibung",
        empfaenger: "Händler",
        waehrung: "Währung",
        betrag_vorzeichen_invertieren: true,
      },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.mapping?.betrag_vorzeichen_invertieren).toBe(true);
    }
  });
});

describe("kontoMappingSchema", () => {
  it("verlangt datum und betrag", () => {
    const r = kontoMappingSchema.safeParse({ datum: "", betrag: "" });
    expect(r.success).toBe(false);
  });

  it("setzt invertieren-Default auf false", () => {
    const r = kontoMappingSchema.safeParse({
      datum: "Datum",
      betrag: "Betrag",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.betrag_vorzeichen_invertieren).toBe(false);
  });

  it("normalisiert leere optionale Spalten zu undefined", () => {
    const r = kontoMappingSchema.safeParse({
      datum: "Datum",
      betrag: "Betrag",
      verwendungszweck: "",
      empfaenger: "   ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.verwendungszweck).toBeUndefined();
      expect(r.data.empfaenger).toBeUndefined();
    }
  });
});

describe("importRequestSchema", () => {
  it("verlangt eine gültige UUID als konto_id", () => {
    expect(
      importRequestSchema.safeParse({ konto_id: "nicht-uuid" }).success,
    ).toBe(false);
    const r = importRequestSchema.safeParse({
      konto_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.preview).toBe(false);
  });

  it("akzeptiert preview-Flag", () => {
    const r = importRequestSchema.safeParse({
      konto_id: "11111111-1111-4111-8111-111111111111",
      preview: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.preview).toBe(true);
  });
});
