import { describe, it, expect } from "vitest";
import {
  berechneEuer,
  rundeCent,
  wirtschaftsjahrGrenzen,
} from "./euer";
import type { Buchung, Kategorie } from "@/lib/types";

// --- Test-Fixtures -------------------------------------------------------

function kat(
  id: string,
  typ: Kategorie["typ"],
  euer_zeile: string | null = null,
  bezeichnung = id,
): Kategorie {
  return {
    id,
    bezeichnung,
    typ,
    ust_satz: typ === "einnahme" || typ === "ausgabe" ? 19 : null,
    euer_zeile,
    elster_kennzahl: null,
    aktiv: true,
    gueltig_ab: null,
  };
}

function bu(
  over: Partial<Buchung> & {
    id: string;
    buchung_datum: string;
    betrag: number;
  },
): Buchung {
  return {
    konto_id: "k1",
    verwendungszweck: null,
    empfaenger: null,
    waehrung: "EUR",
    klassifikation: "geschaeftlich",
    steuerrelevant: true,
    kategorie_id: null,
    ust_satz: null,
    begruendung: null,
    konfidenz: null,
    quelle: "manuell",
    status: "manuell_bestaetigt",
    pruef_grund: null,
    parent_buchung_id: null,
    split_anteil: null,
    gemerkt_am: null,
    ...over,
  };
}

const KAT = {
  erloese: kat("e1", "einnahme", "15", "Erlöse 19%"),
  ustErstattung: kat("e2", "einnahme", "16", "USt-Erstattung"),
  buero: kat("a1", "ausgabe", "51", "Bürobedarf"),
  ustZahllast: kat("a2", "ausgabe", "62", "USt-Zahllast"),
  privatEnt: kat("p1", "privat", null, "Privatentnahme"),
  geldtransit: kat("n1", "neutral", null, "Geldtransit"),
};
const KATEGORIEN = Object.values(KAT);

// --- rundeCent -----------------------------------------------------------

describe("rundeCent", () => {
  it("rundet cent-genau kaufmännisch und vermeidet Float-Drift", () => {
    expect(rundeCent(0.1 + 0.2)).toBe(0.3);
    expect(rundeCent(2.005)).toBe(2.01);
    expect(rundeCent(-2.005)).toBe(-2.01);
    expect(rundeCent(1234.564)).toBe(1234.56);
    expect(rundeCent(1234.565)).toBe(1234.57);
  });
});

// --- wirtschaftsjahrGrenzen ---------------------------------------------

describe("wirtschaftsjahrGrenzen", () => {
  it("Kalenderjahr (Beginn Januar)", () => {
    expect(wirtschaftsjahrGrenzen(2025, 1)).toEqual({
      von: "2025-01-01",
      bis: "2025-12-31",
    });
  });

  it("abweichendes Wirtschaftsjahr (Beginn Juli) endet im Folgejahr", () => {
    expect(wirtschaftsjahrGrenzen(2025, 7)).toEqual({
      von: "2025-07-01",
      bis: "2026-06-30",
    });
  });

  it("abweichendes WJ mit Beginn April (Schaltjahr-Vormonat März)", () => {
    expect(wirtschaftsjahrGrenzen(2024, 4)).toEqual({
      von: "2024-04-01",
      bis: "2025-03-31",
    });
  });

  it("ungültiger Monat fällt auf Kalenderjahr zurück", () => {
    expect(wirtschaftsjahrGrenzen(2025, 0)).toEqual({
      von: "2025-01-01",
      bis: "2025-12-31",
    });
    expect(wirtschaftsjahrGrenzen(2025, 13)).toEqual({
      von: "2025-01-01",
      bis: "2025-12-31",
    });
  });
});

// --- berechneEuer: Zufluss-/Abflussprinzip am Jahreswechsel --------------

describe("berechneEuer – Periodenabgrenzung (Zufluss/Abfluss)", () => {
  it("ordnet Buchungen strikt nach buchung_datum zum WJ zu (Dez vs. Jan)", () => {
    const buchungen: Buchung[] = [
      bu({
        id: "b-dez",
        buchung_datum: "2025-12-31",
        betrag: 1000,
        kategorie_id: "e1",
      }),
      bu({
        id: "b-jan",
        buchung_datum: "2026-01-01",
        betrag: 2000,
        kategorie_id: "e1",
      }),
    ];
    const r2025 = berechneEuer(buchungen, KATEGORIEN, 2025, 1);
    expect(r2025.summe_einnahmen).toBe(1000);
    expect(r2025.betriebseinnahmen[0].anzahl).toBe(1);

    const r2026 = berechneEuer(buchungen, KATEGORIEN, 2026, 1);
    expect(r2026.summe_einnahmen).toBe(2000);
  });

  it("respektiert abweichendes Wirtschaftsjahr (Juli–Juni)", () => {
    const buchungen: Buchung[] = [
      bu({
        id: "vor",
        buchung_datum: "2025-06-30",
        betrag: 500,
        kategorie_id: "e1",
      }),
      bu({
        id: "drin1",
        buchung_datum: "2025-07-01",
        betrag: 800,
        kategorie_id: "e1",
      }),
      bu({
        id: "drin2",
        buchung_datum: "2026-06-30",
        betrag: 700,
        kategorie_id: "e1",
      }),
      bu({
        id: "nach",
        buchung_datum: "2026-07-01",
        betrag: 999,
        kategorie_id: "e1",
      }),
    ];
    const r = berechneEuer(buchungen, KATEGORIEN, 2025, 7);
    expect(r.zeitraum).toEqual({ von: "2025-07-01", bis: "2026-06-30" });
    expect(r.summe_einnahmen).toBe(1500);
    expect(r.betriebseinnahmen[0].anzahl).toBe(2);
  });
});

// --- berechneEuer: Gruppierung, Gewinn/Verlust ---------------------------

describe("berechneEuer – Gruppierung & Ergebnis", () => {
  it("gruppiert je Kategorie und sortiert nach EÜR-Zeile", () => {
    const buchungen: Buchung[] = [
      bu({ id: "1", buchung_datum: "2025-03-01", betrag: 1000, kategorie_id: "e1" }),
      bu({ id: "2", buchung_datum: "2025-04-01", betrag: 500, kategorie_id: "e1" }),
      bu({ id: "3", buchung_datum: "2025-05-01", betrag: -200, kategorie_id: "a1" }),
      bu({ id: "4", buchung_datum: "2025-06-01", betrag: -50, kategorie_id: "a2" }),
    ];
    const r = berechneEuer(buchungen, KATEGORIEN, 2025, 1);
    expect(r.betriebseinnahmen).toHaveLength(1);
    expect(r.betriebseinnahmen[0].kategorie_id).toBe("e1");
    expect(r.betriebseinnahmen[0].summe).toBe(1500);
    expect(r.betriebseinnahmen[0].anzahl).toBe(2);

    expect(r.betriebsausgaben).toHaveLength(2);
    // Zeile "51" (Büro) vor "62" (USt-Zahllast)
    expect(r.betriebsausgaben[0].euer_zeile).toBe("51");
    expect(r.betriebsausgaben[1].euer_zeile).toBe("62");
    expect(r.betriebsausgaben[0].summe).toBe(200);
  });

  it("berechnet Gewinn (Einnahmen − Ausgaben)", () => {
    const buchungen: Buchung[] = [
      bu({ id: "1", buchung_datum: "2025-03-01", betrag: 10000, kategorie_id: "e1" }),
      bu({ id: "2", buchung_datum: "2025-04-01", betrag: -3500, kategorie_id: "a1" }),
    ];
    const r = berechneEuer(buchungen, KATEGORIEN, 2025, 1);
    expect(r.summe_einnahmen).toBe(10000);
    expect(r.summe_ausgaben).toBe(3500);
    expect(r.gewinn).toBe(6500);
  });

  it("berechnet Verlust (negativer Gewinn)", () => {
    const buchungen: Buchung[] = [
      bu({ id: "1", buchung_datum: "2025-03-01", betrag: 1000, kategorie_id: "e1" }),
      bu({ id: "2", buchung_datum: "2025-04-01", betrag: -4000, kategorie_id: "a1" }),
    ];
    const r = berechneEuer(buchungen, KATEGORIEN, 2025, 1);
    expect(r.gewinn).toBe(-3000);
  });

  it("berücksichtigt USt-Zahllast als Ausgabe und USt-Erstattung als Einnahme", () => {
    const buchungen: Buchung[] = [
      bu({ id: "1", buchung_datum: "2025-03-01", betrag: 5000, kategorie_id: "e1" }),
      bu({ id: "2", buchung_datum: "2025-05-10", betrag: 300, kategorie_id: "e2" }),
      bu({ id: "3", buchung_datum: "2025-04-10", betrag: -950, kategorie_id: "a2" }),
    ];
    const r = berechneEuer(buchungen, KATEGORIEN, 2025, 1);
    // USt-Erstattung in Einnahmen
    expect(
      r.betriebseinnahmen.find((g) => g.kategorie_id === "e2")?.summe,
    ).toBe(300);
    expect(r.summe_einnahmen).toBe(5300);
    // USt-Zahllast in Ausgaben
    expect(
      r.betriebsausgaben.find((g) => g.kategorie_id === "a2")?.summe,
    ).toBe(950);
    expect(r.gewinn).toBe(5300 - 950);
  });
});

// --- berechneEuer: Ausschlüsse ------------------------------------------

describe("berechneEuer – Ausschlüsse", () => {
  it("schließt private Buchungen aus", () => {
    const buchungen: Buchung[] = [
      bu({ id: "1", buchung_datum: "2025-03-01", betrag: 1000, kategorie_id: "e1" }),
      bu({
        id: "2",
        buchung_datum: "2025-04-01",
        betrag: -2000,
        kategorie_id: "p1",
        klassifikation: "privat",
      }),
    ];
    const r = berechneEuer(buchungen, KATEGORIEN, 2025, 1);
    expect(r.summe_ausgaben).toBe(0);
    expect(r.summe_einnahmen).toBe(1000);
    expect(r.gewinn).toBe(1000);
  });

  it("schließt neutrale Buchungen / Geldtransit aus (kein Ertrag/Aufwand)", () => {
    const buchungen: Buchung[] = [
      bu({ id: "1", buchung_datum: "2025-03-01", betrag: 1000, kategorie_id: "e1" }),
      bu({
        id: "transit",
        buchung_datum: "2025-04-01",
        betrag: -5000,
        kategorie_id: "n1",
        klassifikation: "neutral",
      }),
    ];
    const r = berechneEuer(buchungen, KATEGORIEN, 2025, 1);
    expect(r.summe_einnahmen).toBe(1000);
    expect(r.summe_ausgaben).toBe(0);
    expect(r.ohne_kategorie.anzahl).toBe(0);
  });

  it("schließt 'unklar' klassifizierte Buchungen aus", () => {
    const buchungen: Buchung[] = [
      bu({
        id: "1",
        buchung_datum: "2025-03-01",
        betrag: 1000,
        kategorie_id: "e1",
        klassifikation: "unklar",
      }),
    ];
    const r = berechneEuer(buchungen, KATEGORIEN, 2025, 1);
    expect(r.summe_einnahmen).toBe(0);
  });

  it("zählt geschäftliche Buchung ohne Kategorie als Hinweis, nicht in Summen", () => {
    const buchungen: Buchung[] = [
      bu({
        id: "1",
        buchung_datum: "2025-03-01",
        betrag: 1200,
        kategorie_id: null,
      }),
      bu({
        id: "2",
        buchung_datum: "2025-04-01",
        betrag: -300,
        kategorie_id: null,
      }),
    ];
    const r = berechneEuer(buchungen, KATEGORIEN, 2025, 1);
    expect(r.summe_einnahmen).toBe(0);
    expect(r.summe_ausgaben).toBe(0);
    expect(r.ohne_kategorie.anzahl).toBe(2);
    expect(r.ohne_kategorie.summe_einnahmen).toBe(1200);
    expect(r.ohne_kategorie.summe_ausgaben).toBe(300);
  });
});

// --- berechneEuer: Rundung & Leerfall -----------------------------------

describe("berechneEuer – Rundung & Leerfall", () => {
  it("rundet Positions- und Gesamtsummen cent-genau", () => {
    const buchungen: Buchung[] = [
      bu({ id: "1", buchung_datum: "2025-01-10", betrag: 100.005, kategorie_id: "e1" }),
      bu({ id: "2", buchung_datum: "2025-02-10", betrag: 0.005, kategorie_id: "e1" }),
      bu({ id: "3", buchung_datum: "2025-03-10", betrag: -33.333, kategorie_id: "a1" }),
    ];
    const r = berechneEuer(buchungen, KATEGORIEN, 2025, 1);
    expect(r.betriebseinnahmen[0].summe).toBe(100.01);
    expect(r.summe_ausgaben).toBe(33.33);
    expect(r.gewinn).toBe(rundeCent(100.01 - 33.33));
  });

  it("liefert für ein leeres Jahr Nullsummen und leere Gruppen", () => {
    const r = berechneEuer([], KATEGORIEN, 2025, 1);
    expect(r.betriebseinnahmen).toEqual([]);
    expect(r.betriebsausgaben).toEqual([]);
    expect(r.summe_einnahmen).toBe(0);
    expect(r.summe_ausgaben).toBe(0);
    expect(r.gewinn).toBe(0);
    expect(r.ohne_kategorie.anzahl).toBe(0);
    expect(r.zeitraum).toEqual({ von: "2025-01-01", bis: "2025-12-31" });
  });

  it("sortiert Buchungen innerhalb einer Gruppe nach Datum (Drill-down)", () => {
    const buchungen: Buchung[] = [
      bu({ id: "spaet", buchung_datum: "2025-09-01", betrag: 100, kategorie_id: "e1" }),
      bu({ id: "frueh", buchung_datum: "2025-02-01", betrag: 200, kategorie_id: "e1" }),
    ];
    const r = berechneEuer(buchungen, KATEGORIEN, 2025, 1);
    const ids = r.betriebseinnahmen[0].buchungen.map((b) => b.id);
    expect(ids).toEqual(["frueh", "spaet"]);
  });
});
