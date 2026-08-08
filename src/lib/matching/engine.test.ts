import { describe, it, expect } from "vitest";
import {
  fuehreMatchingAus,
  DEFAULT_ENGINE_CONFIG,
  type BestehendeZuordnung,
  type BuchungFuerEngine,
} from "./engine";
import type { BelegFuerScore } from "./score";

function b(over: Partial<BuchungFuerEngine> = {}): BuchungFuerEngine {
  return {
    id: "b1",
    betrag: -119,
    buchung_datum: "2026-03-15",
    verwendungszweck: "Rechnung 4711 Bürobedarf Müller GmbH",
    empfaenger: "Bürobedarf Müller GmbH",
    klassifikation: "geschaeftlich",
    ...over,
  };
}

function r(over: Partial<BelegFuerScore> = {}): BelegFuerScore {
  return {
    id: "r1",
    betrag: 119,
    beleg_datum: "2026-03-14",
    titel: "Rechnung 4711 Bürobedarf",
    korrespondent: "Bürobedarf Müller GmbH",
    ocr_text: "Rechnung 4711 Bürobedarf Müller GmbH Stifte",
    ...over,
  };
}

describe("fuehreMatchingAus — Grundfälle", () => {
  it("eindeutiger Treffer → status 'auto'", () => {
    const res = fuehreMatchingAus([b()], [r()], []);
    expect(res.vorschlaege).toHaveLength(1);
    expect(res.vorschlaege[0].status).toBe("auto");
    expect(res.vorschlaege[0].beleg_id).toBe("r1");
    expect(res.statistik.auto).toBe(1);
  });

  it("zwei sehr ähnliche Belege (gleicher Betrag/Datum) → 'unsicher', mehrere Vorschläge", () => {
    const beleg1 = r({ id: "r1" });
    const beleg2 = r({ id: "r2" });
    const res = fuehreMatchingAus([b()], [beleg1, beleg2], []);
    expect(res.statistik.unsicher).toBe(1);
    expect(res.statistik.auto).toBe(0);
    const fuerB1 = res.vorschlaege.filter((v) => v.buchung_id === "b1");
    expect(fuerB1.length).toBeGreaterThanOrEqual(2);
    expect(fuerB1.every((v) => v.status === "unsicher")).toBe(true);
  });

  it("begrenzt eine mehrdeutige Prüfliste auf die drei besten Kandidaten", () => {
    const belege = Array.from({ length: 10 }, (_, index) =>
      r({ id: `r${index + 1}` }),
    );

    const res = fuehreMatchingAus([b()], belege, []);

    expect(res.statistik.unsicher).toBe(1);
    expect(res.vorschlaege).toHaveLength(3);
    expect(res.vorschlaege.every((v) => v.status === "unsicher")).toBe(true);
  });

  it("zeigt bei Mehrdeutigkeit keine deutlich schwächeren Kandidaten", () => {
    const bester = r({ id: "top" });
    const schwach = r({
      id: "weak",
      titel: "Andere Rechnung",
      korrespondent: "Andere Firma",
      ocr_text: "Fremder Vorgang",
    });

    const res = fuehreMatchingAus([b()], [bester, schwach], [], {
      ...DEFAULT_ENGINE_CONFIG,
      eindeutig_vorsprung: 1,
    });

    expect(res.vorschlaege).toHaveLength(1);
    expect(res.vorschlaege[0]).toMatchObject({
      beleg_id: "top",
      status: "unsicher",
    });
  });

  it("kein passender Beleg → Buchung landet in Fehlliste A", () => {
    const fremd = r({
      betrag: 9999,
      korrespondent: "Ganz andere Firma",
      titel: "Unrelated",
      ocr_text: "nichts",
      beleg_datum: "2025-01-01",
    });
    const res = fuehreMatchingAus([b()], [fremd], []);
    expect(res.vorschlaege).toHaveLength(0);
    expect(res.buchungen_ohne_beleg).toEqual(["b1"]);
    expect(res.statistik.ohne_beleg).toBe(1);
  });

  it("schlägt trotz identischem Text niemals einen stark abweichenden Betrag vor", () => {
    const res = fuehreMatchingAus(
      [b({ betrag: -1000 })],
      [r({ betrag: 100 })],
      [],
    );
    expect(res.vorschlaege).toHaveLength(0);
    expect(res.buchungen_ohne_beleg).toEqual(["b1"]);
  });
});

describe("fuehreMatchingAus — Klassifikation", () => {
  it("private Buchung wird ignoriert (kein Beleg-Soll, nicht in Fehlliste)", () => {
    const priv = b({ id: "p1", klassifikation: "privat" });
    const res = fuehreMatchingAus([priv], [r()], []);
    expect(res.vorschlaege).toHaveLength(0);
    expect(res.buchungen_ohne_beleg).toHaveLength(0);
    expect(res.statistik.ignoriert_nicht_geschaeftlich).toBe(1);
    expect(res.statistik.geprueft).toBe(0);
  });

  it("neutral/unklar werden ebenfalls ignoriert", () => {
    const res = fuehreMatchingAus(
      [
        b({ id: "n1", klassifikation: "neutral" }),
        b({ id: "u1", klassifikation: "unklar" }),
        b({ id: "x1", klassifikation: null }),
      ],
      [r()],
      [],
    );
    expect(res.statistik.ignoriert_nicht_geschaeftlich).toBe(3);
    expect(res.vorschlaege).toHaveLength(0);
  });
});

describe("fuehreMatchingAus — gesperrte Zuordnungen", () => {
  it("gesperrte (manuelle) Zuordnung überlebt Re-Matching (Buchung übersprungen)", () => {
    const bestehende: BestehendeZuordnung[] = [
      { beleg_id: "r9", buchung_id: "b1", gesperrt: true },
    ];
    const res = fuehreMatchingAus([b()], [r()], bestehende);
    expect(res.vorschlaege).toHaveLength(0);
    expect(res.statistik.uebersprungen_gesperrt).toBe(1);
    expect(res.statistik.geprueft).toBe(0);
    expect(res.buchungen_ohne_beleg).toHaveLength(0);
  });

  it("nicht-gesperrte bestehende Zuordnung blockiert NICHT (wird neu gerechnet)", () => {
    const bestehende: BestehendeZuordnung[] = [
      { beleg_id: "r1", buchung_id: "b1", gesperrt: false },
    ];
    const res = fuehreMatchingAus([b()], [r()], bestehende);
    expect(res.statistik.geprueft).toBe(1);
    expect(res.vorschlaege).toHaveLength(1);
    expect(res.vorschlaege[0].status).toBe("auto");
  });
});

describe("fuehreMatchingAus — N:M", () => {
  it("Ratenzahlung: 1 Beleg ↔ mehrere Buchungen (jede für sich gematcht)", () => {
    const rate1 = b({ id: "rate1", buchung_datum: "2026-03-15" });
    const rate2 = b({ id: "rate2", buchung_datum: "2026-03-18" });
    const beleg = r();
    const res = fuehreMatchingAus([rate1, rate2], [beleg], []);
    const belegMatches = res.vorschlaege.filter((v) => v.beleg_id === "r1");
    expect(belegMatches.map((v) => v.buchung_id).sort()).toEqual([
      "rate1",
      "rate2",
    ]);
    // Derselbe Beleg darf nie blind für mehrere Buchungen auto-bestätigt
    // werden. Eine echte Raten-/Sammelzuordnung braucht Nutzerbestätigung.
    expect(belegMatches.every((v) => v.status === "unsicher")).toBe(true);
    expect(res.statistik.auto).toBe(0);
    expect(res.statistik.unsicher).toBe(2);
  });

  it("Sammelrechnung: mehrere Belege als Kandidaten zu 1 Buchung → unsicher", () => {
    const teil1 = r({ id: "t1", betrag: 119 });
    const teil2 = r({ id: "t2", betrag: 119 });
    const res = fuehreMatchingAus([b()], [teil1, teil2], []);
    expect(res.statistik.unsicher).toBe(1);
    const fuerB1 = res.vorschlaege.filter((v) => v.buchung_id === "b1");
    expect(fuerB1.length).toBe(2);
  });
});

describe("fuehreMatchingAus — eindeutig-Vorsprung", () => {
  it("bester knapp vor zweitbestem → kein 'auto', sondern 'unsicher'", () => {
    const top = r({ id: "top" });
    // sehr ähnlicher Beleg, fast gleicher Score → kein Vorsprung
    const fast = r({ id: "fast" });
    const res = fuehreMatchingAus([b()], [top, fast], [], {
      ...DEFAULT_ENGINE_CONFIG,
      eindeutig_vorsprung: 0.5, // künstlich hoher Vorsprung verlangt
    });
    expect(res.statistik.auto).toBe(0);
    expect(res.statistik.unsicher).toBe(1);
  });

  it("nur ein Beleg vorhanden → voller Vorsprung → 'auto'", () => {
    const res = fuehreMatchingAus([b()], [r()], []);
    expect(res.statistik.auto).toBe(1);
  });
});
