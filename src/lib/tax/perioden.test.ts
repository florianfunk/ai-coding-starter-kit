import { describe, it, expect } from "vitest";
import {
  ustVaPerioden,
  ustVaPeriode,
  periodeFuerDatum,
  wirtschaftsjahrGrenzen,
  wirtschaftsjahrZuDatum,
  parseDatum,
  rhythmusFuerPeriode,
} from "./perioden";

describe("Datierter Wechsel von Quartalen auf Monate", () => {
  const profil = { ust_va_rhythmus: "monatlich", ust_va_rhythmus_vorher: "quartalsweise", rhythmus_gueltig_ab: "2026-04-01" } as const;
  it("behält frühere Jahre und Q1 und erzeugt ab April Monatsperioden", () => {
    expect(ustVaPerioden(2025, profil).map((p) => p.label)).toEqual(["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025"]);
    const perioden = ustVaPerioden(2026, profil);
    expect(perioden).toHaveLength(10);
    expect(perioden.map((p) => p.periode)).toEqual([1, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(perioden[0]).toMatchObject({ label: "Q1 2026", start: "2026-01-01", ende: "2026-03-31" });
    expect(perioden[1]).toMatchObject({ label: "April 2026", start: "2026-04-01", ende: "2026-04-30" });
    expect(rhythmusFuerPeriode(perioden[0])).toBe("quartalsweise");
    expect(rhythmusFuerPeriode(perioden[1])).toBe("monatlich");
    expect(ustVaPerioden(2027, profil)).toHaveLength(12);
  });
  it("ordnet Buchungen an der Grenze genau einer Periode zu", () => {
    expect(periodeFuerDatum("2026-03-31", 2026, profil)?.periode).toBe(1);
    expect(periodeFuerDatum("2026-04-01", 2026, profil)?.periode).toBe(4);
    expect(ustVaPeriode(2026, 2, profil)).toBeNull();
    expect(ustVaPeriode(2026, 4, profil)?.label).toBe("April 2026");
    for (let monat=1; monat<=12; monat++) {
      expect(periodeFuerDatum(`2026-${String(monat).padStart(2, "0")}-15`, 2026, profil)).not.toBeNull();
    }
  });
  it("bewahrt das bisherige Verhalten bei Profilen ohne gespeicherten Wechsel", () => {
    expect(ustVaPerioden(2026, { ust_va_rhythmus: "monatlich", rhythmus_gueltig_ab: "2026-04-01" })).toHaveLength(12);
  });
});

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
