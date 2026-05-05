import { describe, expect, it } from "vitest";
import {
  stammdatenSchema,
  preiseSchema,
  auswahlSchema,
  brancheSchema,
} from "./schemas";

describe("stammdatenSchema", () => {
  const valid = {
    kunden_nr: "K-0001",
    firma: "Acme GmbH",
    branche_ids: [],
    status: "aktiv" as const,
  };

  it("akzeptiert minimalen gueltigen Input", () => {
    expect(stammdatenSchema.safeParse(valid).success).toBe(true);
  });

  it("lehnt ungueltige Kunden-Nr. ab", () => {
    const r = stammdatenSchema.safeParse({ ...valid, kunden_nr: "0001" });
    expect(r.success).toBe(false);
  });

  it("lehnt leere Firma ab", () => {
    const r = stammdatenSchema.safeParse({ ...valid, firma: "" });
    expect(r.success).toBe(false);
  });

  it("akzeptiert leere E-Mail (=> null)", () => {
    const r = stammdatenSchema.safeParse({ ...valid, email: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBeNull();
  });

  it("lehnt ungueltige E-Mail ab", () => {
    const r = stammdatenSchema.safeParse({ ...valid, email: "kein-mail" });
    expect(r.success).toBe(false);
  });

  it("akzeptiert standard_filiale lichtengros|eisenkeil|null", () => {
    expect(
      stammdatenSchema.safeParse({ ...valid, standard_filiale: "lichtengros" })
        .success,
    ).toBe(true);
    expect(
      stammdatenSchema.safeParse({ ...valid, standard_filiale: "eisenkeil" })
        .success,
    ).toBe(true);
    expect(
      stammdatenSchema.safeParse({ ...valid, standard_filiale: null }).success,
    ).toBe(true);
  });

  it("lehnt unbekanntes standard_filiale ab", () => {
    const r = stammdatenSchema.safeParse({ ...valid, standard_filiale: "muell" });
    expect(r.success).toBe(false);
  });

  it("lehnt Notizen >2000 Zeichen ab", () => {
    const r = stammdatenSchema.safeParse({
      ...valid,
      notizen: "x".repeat(2001),
    });
    expect(r.success).toBe(false);
  });

  it("lehnt branche_ids als Nicht-UUIDs ab", () => {
    const r = stammdatenSchema.safeParse({ ...valid, branche_ids: ["abc"] });
    expect(r.success).toBe(false);
  });
});

describe("preiseSchema", () => {
  it("akzeptiert gueltige Werte", () => {
    expect(
      preiseSchema.safeParse({
        preis_spur: "listenpreis",
        aufschlag_vorzeichen: "plus",
        aufschlag_pct: 0,
      }).success,
    ).toBe(true);
  });

  it("akzeptiert maximalen Aufschlag 100", () => {
    expect(
      preiseSchema.safeParse({
        preis_spur: "lichtengros",
        aufschlag_vorzeichen: "minus",
        aufschlag_pct: 100,
      }).success,
    ).toBe(true);
  });

  it("lehnt Aufschlag > 100 ab", () => {
    expect(
      preiseSchema.safeParse({
        preis_spur: "listenpreis",
        aufschlag_vorzeichen: "plus",
        aufschlag_pct: 101,
      }).success,
    ).toBe(false);
  });

  it("lehnt negativen Aufschlag ab", () => {
    expect(
      preiseSchema.safeParse({
        preis_spur: "listenpreis",
        aufschlag_vorzeichen: "plus",
        aufschlag_pct: -1,
      }).success,
    ).toBe(false);
  });

  it("lehnt unbekannte Spur ab", () => {
    expect(
      preiseSchema.safeParse({
        preis_spur: "ek",
        aufschlag_vorzeichen: "plus",
        aufschlag_pct: 0,
      }).success,
    ).toBe(false);
  });
});

describe("auswahlSchema", () => {
  it("akzeptiert alle_produkte=true mit leerer Liste", () => {
    expect(
      auswahlSchema.safeParse({ alle_produkte: true, produkt_ids: [] }).success,
    ).toBe(true);
  });

  it("akzeptiert alle_produkte=false mit Whitelist", () => {
    expect(
      auswahlSchema.safeParse({
        alle_produkte: false,
        produkt_ids: ["a1b2c3d4-e5f6-4789-9abc-def012345678"],
      }).success,
    ).toBe(true);
  });

  it("lehnt Nicht-UUIDs ab", () => {
    expect(
      auswahlSchema.safeParse({ alle_produkte: false, produkt_ids: ["abc"] })
        .success,
    ).toBe(false);
  });
});

describe("brancheSchema", () => {
  it("akzeptiert gueltigen Namen", () => {
    expect(brancheSchema.safeParse({ name: "Gastronomie" }).success).toBe(true);
  });

  it("lehnt leeren Namen ab", () => {
    expect(brancheSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("lehnt Namen >80 Zeichen ab", () => {
    expect(
      brancheSchema.safeParse({ name: "x".repeat(81) }).success,
    ).toBe(false);
  });
});
