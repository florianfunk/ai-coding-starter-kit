// PROJ-16 — Tests fuer die Zod-Schemata.

import { describe, it, expect } from "vitest";
import {
  adresseSchema,
  arbeitgeberSchema,
  familieSchema,
  FAMILIE_ROLLEN,
  kontoEigenesSchema,
} from "./profil";

describe("arbeitgeberSchema", () => {
  it("akzeptiert einen Eintrag mit nur Name", () => {
    const r = arbeitgeberSchema.safeParse({ name: "Accenture" });
    expect(r.success).toBe(true);
  });

  it("akzeptiert vollstaendigen Eintrag mit Datumsspanne und Notiz", () => {
    const r = arbeitgeberSchema.safeParse({
      name: "Accenture GmbH",
      aktiv_von: "2024-01-01",
      aktiv_bis: "2026-12-31",
      notiz: "parallel zur Selbstaendigkeit",
    });
    expect(r.success).toBe(true);
  });

  it("normalisiert leere Strings zu null bei Datum/Notiz", () => {
    const r = arbeitgeberSchema.safeParse({
      name: "X",
      aktiv_von: "",
      aktiv_bis: "  ",
      notiz: "   ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.aktiv_von).toBeNull();
      expect(r.data.aktiv_bis).toBeNull();
      expect(r.data.notiz).toBeNull();
    }
  });

  it("lehnt leeren Namen ab", () => {
    const r = arbeitgeberSchema.safeParse({ name: "  " });
    expect(r.success).toBe(false);
  });

  it("lehnt ungueltiges Datumsformat ab", () => {
    const r = arbeitgeberSchema.safeParse({
      name: "X",
      aktiv_von: "01.01.2024",
    });
    expect(r.success).toBe(false);
  });

  it("lehnt zu langen Namen ab (>120)", () => {
    const r = arbeitgeberSchema.safeParse({ name: "a".repeat(121) });
    expect(r.success).toBe(false);
  });
});

describe("familieSchema", () => {
  it.each(FAMILIE_ROLLEN)("akzeptiert Rolle '%s'", (rolle) => {
    const r = familieSchema.safeParse({ name: "Anna", rolle });
    expect(r.success).toBe(true);
  });

  it("lehnt unbekannte Rolle ab", () => {
    const r = familieSchema.safeParse({ name: "Anna", rolle: "freund" });
    expect(r.success).toBe(false);
  });

  it("Default fuer auch_geschaeftspartner ist false", () => {
    const r = familieSchema.safeParse({ name: "Anna", rolle: "kind" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.auch_geschaeftspartner).toBe(false);
    }
  });

  it("akzeptiert auch_geschaeftspartner=true", () => {
    const r = familieSchema.safeParse({
      name: "Anna",
      rolle: "ehepartner",
      auch_geschaeftspartner: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.auch_geschaeftspartner).toBe(true);
    }
  });

  it("lehnt leeren Namen ab", () => {
    const r = familieSchema.safeParse({ name: "", rolle: "kind" });
    expect(r.success).toBe(false);
  });
});

describe("adresseSchema", () => {
  it("akzeptiert 5-stellige PLZ", () => {
    const r = adresseSchema.safeParse({
      strasse: "Musterweg 1",
      plz: "10115",
      ort: "Berlin",
    });
    expect(r.success).toBe(true);
  });

  it("akzeptiert 4-stellige PLZ (z. B. AT)", () => {
    const r = adresseSchema.safeParse({ plz: "1010", land: "AT" });
    expect(r.success).toBe(true);
  });

  it("lehnt 3-stellige PLZ ab", () => {
    const r = adresseSchema.safeParse({ plz: "123" });
    expect(r.success).toBe(false);
  });

  it("lehnt PLZ mit Buchstaben ab", () => {
    const r = adresseSchema.safeParse({ plz: "12A45" });
    expect(r.success).toBe(false);
  });

  it("setzt Land-Default auf 'DE'", () => {
    const r = adresseSchema.safeParse({ ort: "Berlin" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.land).toBe("DE");
  });

  it("normalisiert Land in Grossbuchstaben", () => {
    const r = adresseSchema.safeParse({ land: "at" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.land).toBe("AT");
  });

  it("erlaubt komplett leere Eingabe (alles optional)", () => {
    const r = adresseSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});

describe("kontoEigenesSchema", () => {
  it("akzeptiert boolean true", () => {
    const r = kontoEigenesSchema.safeParse({ ist_eigenes_konto: true });
    expect(r.success).toBe(true);
  });

  it("akzeptiert boolean false", () => {
    const r = kontoEigenesSchema.safeParse({ ist_eigenes_konto: false });
    expect(r.success).toBe(true);
  });

  it("lehnt Nicht-Boolean ab", () => {
    const r = kontoEigenesSchema.safeParse({ ist_eigenes_konto: "ja" });
    expect(r.success).toBe(false);
  });
});
