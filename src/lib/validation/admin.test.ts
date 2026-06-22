import { describe, it, expect } from "vitest";
import {
  aiEinstellungSchema,
  passwortAendernSchema,
  wartungSchema,
  WARTUNG_BESTAETIGUNG,
} from "./admin";

describe("aiEinstellungSchema", () => {
  it("akzeptiert Modell ohne Key (Key bleibt unverändert)", () => {
    const r = aiEinstellungSchema.safeParse({
      ai_model: "anthropic/claude-haiku-4-5",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ai_key).toBeUndefined();
  });

  it("akzeptiert Modell mit gesetztem Key", () => {
    const r = aiEinstellungSchema.safeParse({
      ai_key: "vck_test123",
      ai_model: "openai/gpt-4o-mini",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ai_key).toBe("vck_test123");
  });

  it("leerer Key wird zu undefined transformiert", () => {
    const r = aiEinstellungSchema.safeParse({
      ai_key: "   ",
      ai_model: "anthropic/claude-haiku-4-5",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ai_key).toBeUndefined();
  });

  it("lehnt leeres Modell ab", () => {
    const r = aiEinstellungSchema.safeParse({ ai_model: "" });
    expect(r.success).toBe(false);
  });

  it("lehnt zu langen Key ab", () => {
    const r = aiEinstellungSchema.safeParse({
      ai_key: "x".repeat(501),
      ai_model: "anthropic/claude-haiku-4-5",
    });
    expect(r.success).toBe(false);
  });
});

describe("passwortAendernSchema", () => {
  it("akzeptiert gültige Passwortänderung", () => {
    const r = passwortAendernSchema.safeParse({
      aktuelles_passwort: "altespw",
      neues_passwort: "neuespw123",
    });
    expect(r.success).toBe(true);
  });

  it("lehnt zu kurzes neues Passwort ab (< 8 Zeichen)", () => {
    const r = passwortAendernSchema.safeParse({
      aktuelles_passwort: "altespw",
      neues_passwort: "kurz",
    });
    expect(r.success).toBe(false);
  });

  it("lehnt leeres aktuelles Passwort ab", () => {
    const r = passwortAendernSchema.safeParse({
      aktuelles_passwort: "",
      neues_passwort: "neuespw123",
    });
    expect(r.success).toBe(false);
  });

  it("akzeptiert genau 8 Zeichen neues Passwort", () => {
    const r = passwortAendernSchema.safeParse({
      aktuelles_passwort: "x",
      neues_passwort: "12345678",
    });
    expect(r.success).toBe(true);
  });
});

describe("wartungSchema", () => {
  it("akzeptiert alle erlaubten Aktionen mit korrekter Bestätigungsphrase", () => {
    for (const aktion of [
      "buchungen_reset",
      "belege_reset",
      "kontenrahmen_reseed",
    ] as const) {
      const r = wartungSchema.safeParse({
        aktion,
        bestaetigung: WARTUNG_BESTAETIGUNG[aktion],
      });
      expect(r.success, aktion).toBe(true);
    }
  });

  it("lehnt fehlende Bestätigungsphrase ab", () => {
    const r = wartungSchema.safeParse({ aktion: "buchungen_reset" });
    expect(r.success).toBe(false);
  });

  it("lehnt falsche Bestätigungsphrase ab", () => {
    const r = wartungSchema.safeParse({
      aktion: "buchungen_reset",
      bestaetigung: "BELEGE LÖSCHEN",
    });
    expect(r.success).toBe(false);
  });

  it("toleriert umgebende Leerzeichen in der Phrase", () => {
    const r = wartungSchema.safeParse({
      aktion: "belege_reset",
      bestaetigung: "  BELEGE LÖSCHEN  ",
    });
    expect(r.success).toBe(true);
  });

  it("lehnt unbekannte Aktion ab", () => {
    const r = wartungSchema.safeParse({
      aktion: "alles_loeschen",
      bestaetigung: "x",
    });
    expect(r.success).toBe(false);
  });

  it("lehnt fehlende Aktion ab", () => {
    const r = wartungSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});
