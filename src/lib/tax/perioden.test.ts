import { describe, it, expect } from "vitest";
import {
  ustVaPerioden,
  ustVaPeriode,
  periodeFuerDatum,
  wirtschaftsjahrGrenzen,
  wirtschaftsjahrZuDatum,
  parseDatum,
} from "./perioden";

describe("ustVaPerioden", () => {
  it("liefert 12 Monatsperioden bei monatlichem Rhythmus", () => {
    const p = ustVaPerioden(2026, "monatlich");
    expect(p).toHaveLength(12);
    expect(p[0]).toMatchObject({
      jahr: 2026,
      periode: 1,
      start: "2026-01-01",
      ende: "2026-01-31",
    });
    expect(p[1].ende).toBe("2026-02-28"); // 2026 kein Schaltjahr
    expect(p[11]).toMatchObject({ periode: 12, ende: "2026-12-31" });
  });

  it("berücksichtigt Schaltjahr im Februar", () => {
    const p = ustVaPerioden(2024, "monatlich");
    expect(p[1].ende).toBe("2024-02-29");
  });

  it("liefert 4 Quartale bei quartalsweisem Rhythmus", () => {
    const p = ustVaPerioden(2026, "quartalsweise");
    expect(p).toHaveLength(4);
    expect(p[0]).toMatchObject({ start: "2026-01-01", ende: "2026-03-31" });
    expect(p[1]).toMatchObject({ start: "2026-04-01", ende: "2026-06-30" });
    expect(p[3]).toMatchObject({
      periode: 4,
      start: "2026-10-01",
      ende: "2026-12-31",
    });
  });

  it("liefert genau 1 Jahresperiode bei jährlichem Rhythmus", () => {
    const p = ustVaPerioden(2026, "jaehrlich");
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({
      periode: 0,
      start: "2026-01-01",
      ende: "2026-12-31",
    });
  });
});

describe("periodeFuerDatum", () => {
  it("ordnet ein Datum dem korrekten Monat zu", () => {
    const p = periodeFuerDatum("2026-03-15", 2026, "monatlich");
    expect(p?.periode).toBe(3);
  });

  it("ordnet ein Datum dem korrekten Quartal zu", () => {
    const p = periodeFuerDatum("2026-05-02", 2026, "quartalsweise");
    expect(p?.periode).toBe(2);
  });

  it("liefert null bei Datum außerhalb des Jahres", () => {
    expect(periodeFuerDatum("2025-12-31", 2026, "monatlich")).toBeNull();
  });

  it("liefert null bei leerem/ungültigem Datum (→ Ausschluss + Warnung)", () => {
    expect(periodeFuerDatum(null, 2026, "monatlich")).toBeNull();
    expect(periodeFuerDatum("", 2026, "monatlich")).toBeNull();
    expect(periodeFuerDatum("kaputt", 2026, "monatlich")).toBeNull();
  });
});

describe("ustVaPeriode (Einzelabruf)", () => {
  it("findet eine konkrete Periode", () => {
    expect(ustVaPeriode(2026, 7, "monatlich")?.label).toBe("Juli 2026");
    expect(ustVaPeriode(2026, 0, "jaehrlich")?.label).toBe("Jahr 2026");
  });

  it("liefert null bei unbekannter Periodennummer", () => {
    expect(ustVaPeriode(2026, 13, "monatlich")).toBeNull();
  });
});

describe("wirtschaftsjahrGrenzen", () => {
  it("Kalenderjahr bei Beginn = 1", () => {
    expect(wirtschaftsjahrGrenzen(2026, 1)).toEqual({
      start: "2026-01-01",
      ende: "2026-12-31",
    });
  });

  it("abweichendes Wirtschaftsjahr (Beginn April) endet im Folgejahr", () => {
    expect(wirtschaftsjahrGrenzen(2026, 4)).toEqual({
      start: "2026-04-01",
      ende: "2027-03-31",
    });
  });

  it("abweichendes Wirtschaftsjahr (Beginn Juli)", () => {
    expect(wirtschaftsjahrGrenzen(2025, 7)).toEqual({
      start: "2025-07-01",
      ende: "2026-06-30",
    });
  });
});

describe("wirtschaftsjahrZuDatum", () => {
  it("Kalenderjahr-WJ = Kalenderjahr", () => {
    expect(wirtschaftsjahrZuDatum("2026-08-10", 1)).toBe(2026);
  });

  it("abweichendes WJ: Datum vor WJ-Beginn → Vorjahr", () => {
    // WJ beginnt April. 2026-02-10 gehört noch zum WJ 2025.
    expect(wirtschaftsjahrZuDatum("2026-02-10", 4)).toBe(2025);
  });

  it("abweichendes WJ: Datum nach WJ-Beginn → laufendes Jahr", () => {
    expect(wirtschaftsjahrZuDatum("2026-04-01", 4)).toBe(2026);
  });
});

describe("parseDatum", () => {
  it("parst gültiges ISO-Datum", () => {
    const d = parseDatum("2026-03-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
  });

  it("wirft bei ungültigem Datum", () => {
    expect(() => parseDatum("2026-13-01")).toThrow();
    expect(() => parseDatum("2026-02-30")).toThrow();
    expect(() => parseDatum("abc")).toThrow();
  });
});
