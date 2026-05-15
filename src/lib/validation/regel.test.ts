import { describe, it, expect } from "vitest";
import {
  regelInputSchema,
  bedingungenGleich,
  widerspruechlicheFelder,
  findeRegelKonflikte,
  type RegelFuerKonflikt,
} from "./regel";

const KAT_A = "1a1edf1c-328d-4130-b8e0-d6d693ae12fd";
const KAT_B = "32b26e89-82dd-4ca4-b8fe-cc84d38e9268";
const KONTO = "ad8ca2f6-8331-46a7-a280-8c4508318343";

describe("regelInputSchema – Eingabevalidierung", () => {
  it("akzeptiert eine gültige Regel mit Empfänger-Muster und Aktion", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Telekom → Telefon 19%",
      bedingung: { empfaenger_muster: "Telekom" },
      aktion: { kategorie_id: KAT_A, ust_satz: 19 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prioritaet).toBe(100); // default
      expect(result.data.aktiv).toBe(true); // default
    }
  });

  it("lehnt eine Bedingung ohne jede Teilbedingung ab (kein Catch-All)", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Leere Bedingung",
      bedingung: {},
      aktion: { klassifikation: "geschaeftlich" },
    });
    expect(result.success).toBe(false);
  });

  it("lehnt eine Aktion ohne jedes Aktionsfeld ab", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Ohne Wirkung",
      bedingung: { zweck_muster: "Miete" },
      aktion: {},
    });
    expect(result.success).toBe(false);
  });

  it("lehnt betrag_min > betrag_max ab", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Ungültiger Bereich",
      bedingung: { betrag_min: 500, betrag_max: 100 },
      aktion: { klassifikation: "privat" },
    });
    expect(result.success).toBe(false);
  });

  it("lehnt einen unzulässigen USt-Satz (16) ab", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Alt-Satz",
      bedingung: { empfaenger_muster: "Foo" },
      aktion: { ust_satz: 16 },
    });
    expect(result.success).toBe(false);
  });

  it("lehnt zu kurze Bezeichnung ab", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "A",
      bedingung: { empfaenger_muster: "Foo" },
      aktion: { klassifikation: "neutral" },
    });
    expect(result.success).toBe(false);
  });

  it("normalisiert leere optionale Muster zu undefined", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Nur Konto",
      bedingung: { empfaenger_muster: "", konto_id: KONTO },
      aktion: { klassifikation: "geschaeftlich" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bedingung.empfaenger_muster).toBeUndefined();
      expect(result.data.bedingung.konto_id).toBe(KONTO);
    }
  });

  it("akzeptiert eine Regel mit eigener Priorität und aktiv=false", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Inaktive Spezialregel",
      bedingung: { zweck_muster: "PayPal" },
      aktion: { klassifikation: "geschaeftlich" },
      prioritaet: 500,
      aktiv: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prioritaet).toBe(500);
      expect(result.data.aktiv).toBe(false);
    }
  });
});

describe("bedingungenGleich", () => {
  it("erkennt identische Muster case-insensitiv als gleich", () => {
    expect(
      bedingungenGleich(
        { empfaenger_muster: "Telekom" },
        { empfaenger_muster: "telekom" },
      ),
    ).toBe(true);
  });

  it("erkennt abweichende Betragsgrenzen als ungleich", () => {
    expect(
      bedingungenGleich(
        { empfaenger_muster: "X", betrag_min: 10 },
        { empfaenger_muster: "X", betrag_min: 20 },
      ),
    ).toBe(false);
  });
});

describe("widerspruechlicheFelder", () => {
  it("meldet abweichende Kategorie und USt als Konfliktfelder", () => {
    const felder = widerspruechlicheFelder(
      { kategorie_id: KAT_A, ust_satz: 19 },
      { kategorie_id: KAT_B, ust_satz: 7 },
    );
    expect(felder).toEqual(["kategorie_id", "ust_satz"]);
  });

  it("meldet keinen Konflikt, wenn ein Feld nur einseitig gesetzt ist", () => {
    const felder = widerspruechlicheFelder(
      { kategorie_id: KAT_A },
      { ust_satz: 19 },
    );
    expect(felder).toEqual([]);
  });
});

describe("findeRegelKonflikte", () => {
  const bestehende: RegelFuerKonflikt[] = [
    {
      id: "r-1",
      bedingung: { empfaenger_muster: "Telekom" },
      aktion: { kategorie_id: KAT_A },
      prioritaet: 100,
      aktiv: true,
    },
  ];

  it("erkennt einen Konflikt bei gleicher Priorität + Bedingung, abweichender Aktion", () => {
    const konflikte = findeRegelKonflikte(
      {
        bedingung: { empfaenger_muster: "telekom" },
        aktion: { kategorie_id: KAT_B },
        prioritaet: 100,
        aktiv: true,
      },
      bestehende,
    );
    expect(konflikte).toHaveLength(1);
    expect(konflikte[0].regel_id).toBe("r-1");
    expect(konflikte[0].felder).toContain("kategorie_id");
  });

  it("meldet keinen Konflikt bei unterschiedlicher Priorität", () => {
    const konflikte = findeRegelKonflikte(
      {
        bedingung: { empfaenger_muster: "Telekom" },
        aktion: { kategorie_id: KAT_B },
        prioritaet: 200,
        aktiv: true,
      },
      bestehende,
    );
    expect(konflikte).toHaveLength(0);
  });

  it("schließt die eigene Regel beim Bearbeiten aus", () => {
    const konflikte = findeRegelKonflikte(
      {
        id: "r-1",
        bedingung: { empfaenger_muster: "Telekom" },
        aktion: { kategorie_id: KAT_B },
        prioritaet: 100,
        aktiv: true,
      },
      bestehende,
    );
    expect(konflikte).toHaveLength(0);
  });

  it("ignoriert Konflikte, wenn der Kandidat inaktiv ist", () => {
    const konflikte = findeRegelKonflikte(
      {
        bedingung: { empfaenger_muster: "Telekom" },
        aktion: { kategorie_id: KAT_B },
        prioritaet: 100,
        aktiv: false,
      },
      bestehende,
    );
    expect(konflikte).toHaveLength(0);
  });
});
