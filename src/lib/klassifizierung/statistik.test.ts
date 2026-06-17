import { describe, expect, it } from "vitest";
import { baueKlassifizierungStatistik, type StatZeile } from "./statistik";

function z(over: Partial<StatZeile>): StatZeile {
  return {
    status: "offen",
    quelle: null,
    buchung_datum: "2025-03-01",
    ...over,
  };
}

describe("baueKlassifizierungStatistik", () => {
  it("aggregiert je Jahr + gesamt nach Status und Quelle", () => {
    const stat = baueKlassifizierungStatistik([
      z({ status: "offen", quelle: null, buchung_datum: "2025-01-10" }),
      z({ status: "auto_verbucht", quelle: "vorjahr", buchung_datum: "2025-02-10" }),
      z({ status: "auto_verbucht", quelle: "ki", buchung_datum: "2025-02-11" }),
      z({ status: "zur_pruefung", quelle: "ki", buchung_datum: "2025-02-12" }),
      z({ status: "manuell_bestaetigt", quelle: "manuell", buchung_datum: "2026-05-01" }),
      z({ status: "auto_verbucht", quelle: "regel", buchung_datum: "2026-05-02" }),
    ]);

    expect(stat.gesamt.total).toBe(6);
    expect(stat.gesamt.offen).toBe(1);
    expect(stat.gesamt.verarbeitet).toBe(5);
    expect(stat.gesamt.via_vorjahr).toBe(1);
    expect(stat.gesamt.via_ki).toBe(2);
    expect(stat.gesamt.via_regel).toBe(1);
    expect(stat.gesamt.via_manuell).toBe(1);

    // Jahre absteigend: 2026 zuerst.
    expect(stat.jahre.map((j) => j.jahr)).toEqual([2026, 2025]);

    const y2025 = stat.jahre.find((j) => j.jahr === 2025)!;
    expect(y2025.total).toBe(4);
    expect(y2025.offen).toBe(1);
    expect(y2025.verarbeitet).toBe(3);
    expect(y2025.auto_verbucht).toBe(2);
    expect(y2025.zur_pruefung).toBe(1);

    const y2026 = stat.jahre.find((j) => j.jahr === 2026)!;
    expect(y2026.total).toBe(2);
    expect(y2026.manuell_bestaetigt).toBe(1);
    expect(y2026.offen).toBe(0);
    expect(y2026.verarbeitet).toBe(2);
  });

  it("leere Eingabe → leere Statistik", () => {
    const stat = baueKlassifizierungStatistik([]);
    expect(stat.jahre).toEqual([]);
    expect(stat.gesamt.total).toBe(0);
    expect(stat.gesamt.verarbeitet).toBe(0);
  });

  it("zählt Zeilen ohne Datum nur im Gesamt", () => {
    const stat = baueKlassifizierungStatistik([
      z({ status: "offen", buchung_datum: null }),
      z({ status: "auto_verbucht", buchung_datum: "2025-01-01" }),
    ]);
    expect(stat.gesamt.total).toBe(2);
    expect(stat.jahre).toHaveLength(1);
    expect(stat.jahre[0].jahr).toBe(2025);
    expect(stat.jahre[0].total).toBe(1);
  });
});
