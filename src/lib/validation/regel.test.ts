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

describe("regelInputSchema – PROJ-15 Regex-Felder", () => {
  it("akzeptiert ein gültiges empfaenger_regex", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Stripe-Provider",
      bedingung: { empfaenger_regex: "^stripe\\*.*" },
      aktion: { klassifikation: "geschaeftlich" },
    });
    expect(result.success).toBe(true);
  });

  it("zählt ein gesetztes Regex als gültige Bedingung (kein Catch-All-Fehler)", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Nur Regex",
      bedingung: { zweck_regex: "abo|subscription" },
      aktion: { klassifikation: "geschaeftlich" },
    });
    expect(result.success).toBe(true);
  });

  it("lehnt ein ReDoS-unsicheres Regex ab", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Böses Regex",
      bedingung: { empfaenger_regex: "(a+)+" },
      aktion: { klassifikation: "geschaeftlich" },
    });
    expect(result.success).toBe(false);
  });

  it("lehnt ein ungültiges Regex ab", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Kaputtes Regex",
      bedingung: { zweck_regex: "(unbalanced" },
      aktion: { klassifikation: "geschaeftlich" },
    });
    expect(result.success).toBe(false);
  });

  it("lehnt ein Regex > 200 Zeichen ab", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Zu lang",
      bedingung: { empfaenger_regex: "a".repeat(201) },
      aktion: { klassifikation: "geschaeftlich" },
    });
    expect(result.success).toBe(false);
  });
});

describe("regelInputSchema – PROJ-15 Split-Aktion", () => {
  const KAT_G = "11111111-1111-4111-8111-111111111111";
  const KAT_P = "22222222-2222-4222-8222-222222222222";

  it("akzeptiert eine gültige 70/30-Split-Aktion", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Handy 70/30",
      bedingung: { empfaenger_muster: "Telekom" },
      aktion: {
        split: {
          anteil_geschaeftlich: 0.7,
          anteil_privat: 0.3,
          kategorie_geschaeftlich: KAT_G,
          kategorie_privat: KAT_P,
          ust_satz_geschaeftlich: 19,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("lehnt Split-Anteile ab, die sich nicht zu 1 summieren", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Falscher Split",
      bedingung: { empfaenger_muster: "Telekom" },
      aktion: {
        split: { anteil_geschaeftlich: 0.7, anteil_privat: 0.4 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("lehnt Split zusammen mit kategorie_id ab (gegenseitiger Ausschluss)", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Split + Kategorie",
      bedingung: { empfaenger_muster: "Telekom" },
      aktion: {
        kategorie_id: KAT_G,
        split: { anteil_geschaeftlich: 0.6, anteil_privat: 0.4 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("lehnt Split zusammen mit klassifikation ab (gegenseitiger Ausschluss)", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Split + Klassifikation",
      bedingung: { empfaenger_muster: "Telekom" },
      aktion: {
        klassifikation: "geschaeftlich",
        split: { anteil_geschaeftlich: 0.6, anteil_privat: 0.4 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("lehnt Anteil 0 oder 1 ab (echte Aufteilung nötig)", () => {
    const result = regelInputSchema.safeParse({
      bezeichnung: "Kein echter Split",
      bedingung: { empfaenger_muster: "Telekom" },
      aktion: {
        split: { anteil_geschaeftlich: 1, anteil_privat: 0 },
      },
    });
    expect(result.success).toBe(false);
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

  it("erkennt identische Regex-Felder als gleich (case-insensitiv)", () => {
    expect(
      bedingungenGleich(
        { empfaenger_regex: "^STRIPE\\*" },
        { empfaenger_regex: "^stripe\\*" },
      ),
    ).toBe(true);
  });

  it("erkennt abweichende empfaenger_regex als ungleich", () => {
    expect(
      bedingungenGleich(
        { empfaenger_regex: "^stripe" },
        { empfaenger_regex: "^paddle" },
      ),
    ).toBe(false);
  });

  it("erkennt abweichende zweck_regex als ungleich", () => {
    expect(
      bedingungenGleich(
        { zweck_muster: "X", zweck_regex: "abo" },
        { zweck_muster: "X", zweck_regex: "miete" },
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
