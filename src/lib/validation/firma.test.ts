import { describe, it, expect } from "vitest";
import { firmenprofilSchema, FIRMENPROFIL_DEFAULTS } from "./firma";

const VALID = {
  firmenname: "Mustermann IT",
  inhaber: "Max Mustermann",
  steuernummer: "12345/67890",
  ust_idnr: "DE123456789",
  strasse: "Musterstraße 1",
  plz: "12345",
  ort: "Musterstadt",
  finanzamt: "Finanzamt Musterstadt",
  rechtsform: "einzelunternehmer",
  ust_status: "regelbesteuerung",
  wirtschaftsjahr_beginn: 1,
  ust_va_rhythmus: "monatlich",
  rhythmus_gueltig_ab: "2026-01-01",
};

describe("firmenprofilSchema", () => {
  it("akzeptiert ein vollständig gültiges Profil", () => {
    const r = firmenprofilSchema.safeParse(VALID);
    expect(r.success).toBe(true);
  });

  it("akzeptiert die leeren Default-Werte (nur Pflichtfelder fehlen)", () => {
    // Defaults haben leere Pflichtfelder -> muss fehlschlagen.
    const r = firmenprofilSchema.safeParse(FIRMENPROFIL_DEFAULTS);
    expect(r.success).toBe(false);
  });

  describe("Pflichtfelder", () => {
    it("lehnt fehlenden Firmennamen ab", () => {
      const r = firmenprofilSchema.safeParse({ ...VALID, firmenname: "" });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues.some((i) => i.path[0] === "firmenname")).toBe(
          true,
        );
      }
    });

    it("lehnt fehlenden Inhaber ab", () => {
      const r = firmenprofilSchema.safeParse({ ...VALID, inhaber: "   " });
      expect(r.success).toBe(false);
    });

    it("lehnt ungültige Rechtsform ab", () => {
      const r = firmenprofilSchema.safeParse({
        ...VALID,
        rechtsform: "gmbh",
      });
      expect(r.success).toBe(false);
    });

    it("lehnt ungültigen USt-Status ab", () => {
      const r = firmenprofilSchema.safeParse({
        ...VALID,
        ust_status: "unbekannt",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("Steuernummer", () => {
    it("ist optional (leerer String erlaubt)", () => {
      const r = firmenprofilSchema.safeParse({ ...VALID, steuernummer: "" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.steuernummer).toBeUndefined();
    });

    it.each(["1234567890", "12345/67890", "123/456/78901", "12 345 67890".replace(/ /g, "")])(
      "akzeptiert gültiges Format %s",
      (nr) => {
        const r = firmenprofilSchema.safeParse({ ...VALID, steuernummer: nr });
        expect(r.success).toBe(true);
      },
    );

    it.each(["abc", "12", "12345/ABCDE", "++++"])(
      "lehnt ungültiges Format %s ab",
      (nr) => {
        const r = firmenprofilSchema.safeParse({ ...VALID, steuernummer: nr });
        expect(r.success).toBe(false);
      },
    );
  });

  describe("USt-IdNr.", () => {
    it("ist optional", () => {
      const r = firmenprofilSchema.safeParse({ ...VALID, ust_idnr: "" });
      expect(r.success).toBe(true);
    });

    it("akzeptiert DE + 9 Ziffern", () => {
      const r = firmenprofilSchema.safeParse({
        ...VALID,
        ust_idnr: "DE123456789",
      });
      expect(r.success).toBe(true);
    });

    it("normalisiert Kleinbuchstaben und Whitespace", () => {
      const r = firmenprofilSchema.safeParse({
        ...VALID,
        ust_idnr: "de 123 456 789",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.ust_idnr).toBe("DE123456789");
    });

    it.each(["DE12345678", "DE1234567890", "FR123456789", "123456789"])(
      "lehnt ungültiges Format %s ab",
      (id) => {
        const r = firmenprofilSchema.safeParse({ ...VALID, ust_idnr: id });
        expect(r.success).toBe(false);
      },
    );
  });

  describe("PLZ", () => {
    it("lehnt PLZ mit falscher Länge ab", () => {
      const r = firmenprofilSchema.safeParse({ ...VALID, plz: "123" });
      expect(r.success).toBe(false);
    });

    it("akzeptiert leere PLZ", () => {
      const r = firmenprofilSchema.safeParse({ ...VALID, plz: "" });
      expect(r.success).toBe(true);
    });
  });

  describe("wirtschaftsjahr_beginn", () => {
    it.each([0, 13, -1])("lehnt Monat %s ab", (m) => {
      const r = firmenprofilSchema.safeParse({
        ...VALID,
        wirtschaftsjahr_beginn: m,
      });
      expect(r.success).toBe(false);
    });

    it("akzeptiert Monate 1–12", () => {
      for (let m = 1; m <= 12; m++) {
        const r = firmenprofilSchema.safeParse({
          ...VALID,
          wirtschaftsjahr_beginn: m,
        });
        expect(r.success).toBe(true);
      }
    });
  });

  describe("rhythmus_gueltig_ab", () => {
    it("ist optional", () => {
      const r = firmenprofilSchema.safeParse({
        ...VALID,
        rhythmus_gueltig_ab: "",
      });
      expect(r.success).toBe(true);
    });

    it("lehnt ungültiges Datumsformat ab", () => {
      const r = firmenprofilSchema.safeParse({
        ...VALID,
        rhythmus_gueltig_ab: "01.01.2026",
      });
      expect(r.success).toBe(false);
    });
  });
});
