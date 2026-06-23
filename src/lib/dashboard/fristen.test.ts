import { describe, it, expect } from "vitest";
import { naechsteUstFrist } from "./fristen";

// Helfer: alle Monate eines Jahres als "abgeschlossen" (realistische Eingabe:
// die Vergangenheit ist regulär eingereicht, nur die jüngsten Perioden sind
// noch offen). Ohne das würde der Rechner korrekt die ÄLTESTE noch offene
// überfällige Periode zurückgeben.
function alleMonate(jahr: number) {
  return Array.from({ length: 12 }, (_, i) => ({ jahr, periode: i + 1 }));
}

describe("naechsteUstFrist — monatlich", () => {
  it("liefert die nächste offene Periode mit Frist = Ende + 10 Tage", () => {
    // Heute 2026-02-05: Januar 2026 (Ende 31.01) offen, Frist 10.02; Vorjahr
    // vollständig abgeschlossen.
    const r = naechsteUstFrist({
      rhythmus: "monatlich",
      heute: "2026-02-05",
      abgeschlossene_perioden: [...alleMonate(2025)],
      dauerfristverlaengerung: false,
    });
    expect(r).not.toBeNull();
    expect(r!.periode.jahr).toBe(2026);
    expect(r!.periode.periode).toBe(1);
    expect(r!.abgabefrist).toBe("2026-02-10");
    expect(r!.tage_bis_frist).toBe(5);
    expect(r!.ueberfaellig).toBe(false);
    expect(r!.ampel).toBe("gelb"); // 5 Tage → gelb (4..14)
  });

  it("überspringt abgeschlossene Perioden", () => {
    // Januar abgeschlossen → nächste ist Februar (Ende 28.02, Frist 10.03).
    const r = naechsteUstFrist({
      rhythmus: "monatlich",
      heute: "2026-02-05",
      abgeschlossene_perioden: [...alleMonate(2025), { jahr: 2026, periode: 1 }],
      dauerfristverlaengerung: false,
    });
    expect(r!.periode.periode).toBe(2);
    expect(r!.abgabefrist).toBe("2026-03-10");
    expect(r!.ueberfaellig).toBe(false);
  });

  it("ampel neutral bei >14 Tagen bis Frist", () => {
    const r = naechsteUstFrist({
      rhythmus: "monatlich",
      heute: "2026-02-20",
      abgeschlossene_perioden: [...alleMonate(2025), { jahr: 2026, periode: 1 }],
      dauerfristverlaengerung: false,
    });
    // Februar offen, Frist 10.03 → 18 Tage → neutral.
    expect(r!.periode.periode).toBe(2);
    expect(r!.tage_bis_frist).toBe(18);
    expect(r!.ampel).toBe("neutral");
  });
});

describe("naechsteUstFrist — Dauerfristverlängerung", () => {
  it("verschiebt die Frist um einen Monat", () => {
    const r = naechsteUstFrist({
      rhythmus: "monatlich",
      heute: "2026-02-05",
      abgeschlossene_perioden: [...alleMonate(2025)],
      dauerfristverlaengerung: true,
    });
    // Januar: Ende 31.01 + 10 = 10.02, +1 Monat = 10.03.
    expect(r!.periode.periode).toBe(1);
    expect(r!.abgabefrist).toBe("2026-03-10");
    expect(r!.ueberfaellig).toBe(false);
  });
});

describe("naechsteUstFrist — überfällig", () => {
  it("gibt überfällige Periode mit negativen Tagen und roter Ampel zurück", () => {
    // Heute 15.03: Januar (Frist 10.02) überfällig, da nicht abgeschlossen.
    const r = naechsteUstFrist({
      rhythmus: "monatlich",
      heute: "2026-03-15",
      abgeschlossene_perioden: [...alleMonate(2025)],
      dauerfristverlaengerung: false,
    });
    expect(r!.periode.periode).toBe(1);
    expect(r!.abgabefrist).toBe("2026-02-10");
    expect(r!.tage_bis_frist).toBeLessThan(0);
    expect(r!.ueberfaellig).toBe(true);
    expect(r!.ampel).toBe("rot");
  });

  it("älteste überfällige Periode hat Vorrang vor künftiger Frist", () => {
    // Heute 15.03, Februar abgeschlossen, Januar offen → Januar überfällig.
    const r = naechsteUstFrist({
      rhythmus: "monatlich",
      heute: "2026-03-15",
      abgeschlossene_perioden: [...alleMonate(2025), { jahr: 2026, periode: 2 }],
      dauerfristverlaengerung: false,
    });
    expect(r!.periode.periode).toBe(1);
    expect(r!.ueberfaellig).toBe(true);
  });
});

describe("naechsteUstFrist — quartalsweise", () => {
  it("liefert die nächste offene Quartalsperiode", () => {
    // Heute 05.04: Q1 (Ende 31.03) offen, Frist 10.04 → 5 Tage → gelb.
    const r = naechsteUstFrist({
      rhythmus: "quartalsweise",
      heute: "2026-04-05",
      abgeschlossene_perioden: [1, 2, 3, 4].map((q) => ({ jahr: 2025, periode: q })),
      dauerfristverlaengerung: false,
    });
    expect(r!.periode.periode).toBe(1);
    expect(r!.periode.label).toBe("Q1 2026");
    expect(r!.abgabefrist).toBe("2026-04-10");
    expect(r!.tage_bis_frist).toBe(5);
    expect(r!.ampel).toBe("gelb");
  });

  it("überspringt abgeschlossenes Quartal", () => {
    const r = naechsteUstFrist({
      rhythmus: "quartalsweise",
      heute: "2026-04-05",
      abgeschlossene_perioden: [
        ...[1, 2, 3, 4].map((q) => ({ jahr: 2025, periode: q })),
        { jahr: 2026, periode: 1 },
      ],
      dauerfristverlaengerung: false,
    });
    // Q2 (Ende 30.06), Frist 10.07.
    expect(r!.periode.periode).toBe(2);
    expect(r!.abgabefrist).toBe("2026-07-10");
  });
});

describe("naechsteUstFrist — jährlich", () => {
  it("liefert die Jahresperiode des Vorjahres als nächste Frist", () => {
    // Heute 05.01.2027: Jahr 2026 (Ende 31.12.2026) offen, Frist 10.01.2027.
    const r = naechsteUstFrist({
      rhythmus: "jaehrlich",
      heute: "2027-01-05",
      abgeschlossene_perioden: [],
      dauerfristverlaengerung: false,
    });
    expect(r!.periode.jahr).toBe(2026);
    expect(r!.periode.periode).toBe(0);
    expect(r!.abgabefrist).toBe("2027-01-10");
    expect(r!.tage_bis_frist).toBe(5);
    expect(r!.ampel).toBe("gelb");
  });
});

describe("naechsteUstFrist — keine offene Frist", () => {
  it("gibt null zurück, wenn alle relevanten Perioden abgeschlossen sind", () => {
    // Heute 05.02: einzige fällige Periode (Januar 2026) ist abgeschlossen,
    // restliche Perioden 2026 sind noch nicht fällig (Frist in der Zukunft) →
    // hier prüfen wir den Fall "alle Kandidaten abgeschlossen".
    const alle = [
      ...Array.from({ length: 12 }, (_, i) => ({ jahr: 2025, periode: i + 1 })),
      ...Array.from({ length: 12 }, (_, i) => ({ jahr: 2026, periode: i + 1 })),
    ];
    const r = naechsteUstFrist({
      rhythmus: "monatlich",
      heute: "2026-02-05",
      abgeschlossene_perioden: alle,
      dauerfristverlaengerung: false,
    });
    expect(r).toBeNull();
  });
});
