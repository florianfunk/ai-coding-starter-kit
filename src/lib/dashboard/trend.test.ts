import { describe, it, expect } from "vitest";
import {
  berechneJahresKennzahlen,
  rundeCent,
  type DashboardBuchung,
} from "./aggregate";
import {
  berechneMonatsReihen,
  letzterUndVormonat,
  type MonatsPunkt,
} from "./trend";

// --- Test-Fixtures -------------------------------------------------------

function bu(over: Partial<DashboardBuchung> = {}): DashboardBuchung {
  return {
    betrag: 100,
    buchung_datum: "2026-03-01",
    klassifikation: "geschaeftlich",
    status: "auto_verbucht",
    ust_satz: null,
    belegt: true,
    ...over,
  };
}

/** Summiert ein KPI-Feld über alle Monatspunkte (cent-gerundet). */
function summe(
  punkte: MonatsPunkt[],
  feld: "einnahmen" | "ausgaben" | "ust_zahllast",
): number {
  return rundeCent(punkte.reduce((s, p) => s + p[feld], 0));
}

// --- berechneMonatsReihen: Struktur -------------------------------------

describe("berechneMonatsReihen — Struktur", () => {
  it("liefert genau 12 Punkte ab WJ-Startmonat (Kalenderjahr)", () => {
    const punkte = berechneMonatsReihen([], "2026-05-15", 1);
    expect(punkte).toHaveLength(12);
    expect(punkte[0].monat).toBe("2026-01");
    expect(punkte[0].label).toBe("Jan");
    expect(punkte[11].monat).toBe("2026-12");
    expect(punkte[11].label).toBe("Dez");
  });

  it("leere Eingabe → alle Monate 0/0/0", () => {
    const punkte = berechneMonatsReihen([], "2026-05-15", 1);
    for (const p of punkte) {
      expect(p.einnahmen).toBe(0);
      expect(p.ausgaben).toBe(0);
      expect(p.ust_zahllast).toBe(0);
    }
  });
});

// --- Verteilung über mehrere Monate -------------------------------------

describe("berechneMonatsReihen — Verteilung", () => {
  it("ordnet Buchungen ihrem Monat zu, Leermonate bleiben 0", () => {
    const punkte = berechneMonatsReihen(
      [
        bu({ betrag: 200, buchung_datum: "2026-01-10" }),
        bu({ betrag: 300, buchung_datum: "2026-01-20" }),
        bu({ betrag: -50, buchung_datum: "2026-03-05" }),
      ],
      "2026-06-01",
      1,
    );
    expect(punkte[0]).toMatchObject({ einnahmen: 500, ausgaben: 0 }); // Jan
    expect(punkte[1]).toMatchObject({ einnahmen: 0, ausgaben: 0 }); // Feb leer
    expect(punkte[2]).toMatchObject({ einnahmen: 0, ausgaben: 50 }); // Mär
  });

  it("nur Einnahmen / nur Ausgaben trennen korrekt", () => {
    const nurEin = berechneMonatsReihen(
      [bu({ betrag: 100, buchung_datum: "2026-02-01" })],
      "2026-06-01",
      1,
    );
    expect(nurEin[1]).toMatchObject({ einnahmen: 100, ausgaben: 0 });

    const nurAus = berechneMonatsReihen(
      [bu({ betrag: -100, buchung_datum: "2026-02-01" })],
      "2026-06-01",
      1,
    );
    expect(nurAus[1]).toMatchObject({ einnahmen: 0, ausgaben: 100 });
  });

  it("ignoriert nicht-geschäftliche und ausserhalb des WJ liegende Buchungen", () => {
    const punkte = berechneMonatsReihen(
      [
        bu({ betrag: 100, buchung_datum: "2026-01-10", klassifikation: "privat" }),
        bu({ betrag: 100, buchung_datum: "2026-01-10", klassifikation: "unklar" }),
        bu({ betrag: 100, buchung_datum: "2025-12-31" }), // Vorjahr, ausserhalb WJ
        bu({ betrag: 100, buchung_datum: "2026-01-10" }), // zählt
      ],
      "2026-06-01",
      1,
    );
    expect(punkte[0].einnahmen).toBe(100);
  });
});

// --- USt-/Vorzeichen-Konvention -----------------------------------------

describe("berechneMonatsReihen — USt-Konvention", () => {
  it("USt-Zahllast pro Monat = USt(Einnahmen) − Vorsteuer(Ausgaben)", () => {
    const punkte = berechneMonatsReihen(
      [
        bu({ betrag: 119, buchung_datum: "2026-04-01", ust_satz: 19 }), // USt 19
        bu({ betrag: -119, buchung_datum: "2026-04-02", ust_satz: 19 }), // Vst 19
        bu({ betrag: 119, buchung_datum: "2026-05-01", ust_satz: 19 }), // USt 19
      ],
      "2026-06-01",
      1,
    );
    expect(punkte[3].ust_zahllast).toBe(0); // Apr: 19 − 19
    expect(punkte[4].ust_zahllast).toBe(19); // Mai: 19 − 0
  });

  it("USt-Satz 0 / null erzeugt keine USt-Zahllast", () => {
    const punkte = berechneMonatsReihen(
      [
        bu({ betrag: 100, buchung_datum: "2026-01-01", ust_satz: 0 }),
        bu({ betrag: 100, buchung_datum: "2026-01-01", ust_satz: null }),
      ],
      "2026-06-01",
      1,
    );
    expect(punkte[0].einnahmen).toBe(200);
    expect(punkte[0].ust_zahllast).toBe(0);
  });
});

// --- Abweichendes Wirtschaftsjahr ---------------------------------------

describe("berechneMonatsReihen — abweichendes WJ", () => {
  it("WJ-Beginn April: Reihenfolge Apr..Mrz inkl. Jahreswechsel + Labels", () => {
    const punkte = berechneMonatsReihen([], "2026-05-15", 4);
    expect(punkte).toHaveLength(12);
    expect(punkte[0].monat).toBe("2026-04");
    expect(punkte[0].label).toBe("Apr 26");
    expect(punkte[8].monat).toBe("2026-12"); // Apr+8 = Dez
    expect(punkte[9].monat).toBe("2027-01"); // Jahreswechsel
    expect(punkte[9].label).toBe("Jan 27");
    expect(punkte[11].monat).toBe("2027-03"); // letzter WJ-Monat
  });

  it("WJ-Beginn Juli: Buchung im Folgejahr-Januar landet im richtigen Bucket", () => {
    // heute Mai 2026, wjBeginn 7 → WJ 2025-07 .. 2026-06.
    const punkte = berechneMonatsReihen(
      [
        bu({ betrag: 100, buchung_datum: "2025-07-15" }), // erster Monat
        bu({ betrag: 200, buchung_datum: "2026-01-15" }), // nach Jahreswechsel
      ],
      "2026-05-15",
      7,
    );
    expect(punkte[0].monat).toBe("2025-07");
    expect(punkte[0].einnahmen).toBe(100);
    const jan = punkte.find((p) => p.monat === "2026-01");
    expect(jan?.einnahmen).toBe(200);
  });
});

// --- Konsistenz mit berechneJahresKennzahlen ----------------------------

describe("berechneMonatsReihen — Konsistenz zum Jahres-Aggregat", () => {
  const buchungen: DashboardBuchung[] = [
    bu({ betrag: 1190, buchung_datum: "2026-01-05", ust_satz: 19 }),
    bu({ betrag: 535, buchung_datum: "2026-03-12", ust_satz: 7 }),
    bu({ betrag: -238, buchung_datum: "2026-03-20", ust_satz: 19 }),
    bu({ betrag: -107, buchung_datum: "2026-07-01", ust_satz: 7 }),
    bu({ betrag: 1000, buchung_datum: "2026-11-30", ust_satz: 0 }),
    bu({ betrag: 100, buchung_datum: "2026-12-31", ust_satz: null }),
    bu({ betrag: 99, buchung_datum: "2026-06-06", klassifikation: "privat" }),
  ];

  it("Summe der Monatswerte == Jahreswert (Einnahmen/Ausgaben/USt)", () => {
    const heute = "2026-12-31";
    const jahr = berechneJahresKennzahlen(buchungen, heute, 1);
    const punkte = berechneMonatsReihen(buchungen, heute, 1);

    expect(summe(punkte, "einnahmen")).toBe(jahr.einnahmen);
    expect(summe(punkte, "ausgaben")).toBe(jahr.ausgaben);
    expect(summe(punkte, "ust_zahllast")).toBe(
      jahr.voraussichtliche_ust_zahllast,
    );
  });

  it("Konsistenz auch bei abweichendem WJ (Beginn April)", () => {
    const heute = "2026-08-01"; // WJ 2026-04 .. 2027-03
    const wjBuchungen: DashboardBuchung[] = [
      bu({ betrag: 1190, buchung_datum: "2026-04-10", ust_satz: 19 }),
      bu({ betrag: -119, buchung_datum: "2026-12-01", ust_satz: 19 }),
      bu({ betrag: 214, buchung_datum: "2027-02-15", ust_satz: 7 }),
    ];
    const jahr = berechneJahresKennzahlen(wjBuchungen, heute, 4);
    const punkte = berechneMonatsReihen(wjBuchungen, heute, 4);

    expect(summe(punkte, "einnahmen")).toBe(jahr.einnahmen);
    expect(summe(punkte, "ausgaben")).toBe(jahr.ausgaben);
    expect(summe(punkte, "ust_zahllast")).toBe(
      jahr.voraussichtliche_ust_zahllast,
    );
  });
});

// --- letzterUndVormonat (Δ-Helfer) --------------------------------------

describe("letzterUndVormonat", () => {
  it("leere Reihe → aktuellerIndex -1, alle Paare 0", () => {
    const d = letzterUndVormonat(berechneMonatsReihen([], "2026-05-15", 1));
    expect(d.aktuellerIndex).toBe(-1);
    expect(d.einnahmen).toEqual({ aktuell: 0, vormonat: 0 });
  });

  it("nimmt jüngsten Monat mit Daten + dessen direkten Vorgänger", () => {
    const punkte = berechneMonatsReihen(
      [
        bu({ betrag: 100, buchung_datum: "2026-02-01" }),
        bu({ betrag: 300, buchung_datum: "2026-04-01" }),
      ],
      "2026-12-31",
      1,
    );
    const d = letzterUndVormonat(punkte);
    expect(d.aktuellerIndex).toBe(3); // April
    expect(d.einnahmen.aktuell).toBe(300);
    expect(d.einnahmen.vormonat).toBe(0); // März leer (direkter Vorgänger)
  });

  it("erster Monat hat Daten → Vormonat 0", () => {
    const punkte = berechneMonatsReihen(
      [bu({ betrag: 100, buchung_datum: "2026-01-15" })],
      "2026-12-31",
      1,
    );
    const d = letzterUndVormonat(punkte);
    expect(d.aktuellerIndex).toBe(0);
    expect(d.einnahmen).toEqual({ aktuell: 100, vormonat: 0 });
  });
});
