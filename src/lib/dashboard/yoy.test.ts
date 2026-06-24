import { describe, it, expect } from "vitest";
import {
  berechneJahresKennzahlen,
  type DashboardBuchung,
} from "./aggregate";
import { berechneYoy, bildeDelta, type YoyKennzahlen } from "./yoy";

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

/** Bezugsjahr-KPIs aus den gleichen Buchungen ableiten (wie load.ts). */
function aktuellAus(
  buchungen: DashboardBuchung[],
  refDatum: string,
  wjBeginn: number,
): YoyKennzahlen {
  const j = berechneJahresKennzahlen(buchungen, refDatum, wjBeginn);
  return {
    einnahmen: j.einnahmen,
    ausgaben: j.ausgaben,
    ust_zahllast: j.voraussichtliche_ust_zahllast,
    gewinn: j.vorlaeufiger_gewinn,
  };
}

// --- bildeDelta: Delta-Bildung + /0-Schutz (AC2) -------------------------

describe("bildeDelta", () => {
  it("absolutes + prozentuales Δ bei vorhandenem Vorjahr", () => {
    const d = bildeDelta(150, 100);
    expect(d.absolut).toBe(50);
    expect(d.prozent).toBe(50);
    expect(d.ist_neu).toBe(false);
  });

  it("Rückgang ergibt negatives Δ", () => {
    const d = bildeDelta(80, 100);
    expect(d.absolut).toBe(-20);
    expect(d.prozent).toBe(-20);
  });

  it("Vorjahr = 0 und aktuell ≠ 0 → prozent null, ist_neu true (kein NaN/∞)", () => {
    const d = bildeDelta(100, 0);
    expect(d.absolut).toBe(100);
    expect(d.prozent).toBeNull();
    expect(d.ist_neu).toBe(true);
    expect(Number.isFinite(d.prozent ?? 0)).toBe(true);
  });

  it("Vorjahr = 0 und aktuell = 0 → prozent null, ist_neu false", () => {
    const d = bildeDelta(0, 0);
    expect(d.absolut).toBe(0);
    expect(d.prozent).toBeNull();
    expect(d.ist_neu).toBe(false);
  });

  it("negatives Vorjahr: Vorzeichen folgt absolut", () => {
    // aktuell -50, vorjahr -100 → absolut = +50 (Verlust halbiert)
    const d = bildeDelta(-50, -100);
    expect(d.absolut).toBe(50);
    expect(d.prozent).toBe(50);
  });

  it("rundet prozent auf 1 Nachkommastelle", () => {
    const d = bildeDelta(100, 3);
    // (97/3)*100 = 3233.33… → 3233.3
    expect(d.prozent).toBe(3233.3);
  });
});

// --- berechneYoy: volles Vorjahr (abgeschlossenes Bezugsjahr, AC1) -------

describe("berechneYoy — volles Vorjahr (abgeschlossenes Bezugsjahr)", () => {
  it("vergleicht das volle Vorjahr, kein YTD-Schnitt", () => {
    const wjBeginn = 1;
    const heute = "2026-06-15"; // laufendes WJ = 2026
    // Bezugsjahr 2025 ist abgeschlossen → refDatum im WJ 2025.
    const refDatum = "2025-01-01";
    const buchungen = [
      // Vorjahr 2024 — über das ganze Jahr verteilt, auch nach Juni:
      bu({ betrag: 1000, buchung_datum: "2024-03-01" }),
      bu({ betrag: 500, buchung_datum: "2024-11-20" }), // nach analogem Juni
      // Bezugsjahr 2025:
      bu({ betrag: 2000, buchung_datum: "2025-04-01" }),
    ];
    const aktuell = aktuellAus(buchungen, refDatum, wjBeginn);
    const yoy = berechneYoy(buchungen, aktuell, refDatum, heute, wjBeginn);

    expect(yoy.ist_ytd).toBe(false);
    expect(yoy.vorjahr_jahr).toBe(2024);
    expect(yoy.vorjahr_zeitraum).toEqual({ von: "2024-01-01", bis: "2024-12-31" });
    // Volles 2024 = 1000 + 500 = 1500.
    expect(yoy.vorjahr.einnahmen).toBe(1500);
    expect(aktuell.einnahmen).toBe(2000);
    expect(yoy.delta.einnahmen.absolut).toBe(500);
  });
});

// --- berechneYoy: YTD-Schnitt (laufendes Bezugsjahr, AC1) ----------------

describe("berechneYoy — YTD-Schnitt (laufendes Bezugsjahr)", () => {
  it("begrenzt das Vorjahr auf denselben YTD-Ausschnitt (bis analoger Tag)", () => {
    const wjBeginn = 1;
    const heute = "2026-06-15"; // laufendes WJ = 2026
    const refDatum = heute; // Bezugsjahr = laufendes WJ 2026
    const buchungen = [
      // Vorjahr 2025:
      bu({ betrag: 1000, buchung_datum: "2025-03-01" }), // vor 15.06. → zählt
      bu({ betrag: 9999, buchung_datum: "2025-09-01" }), // nach 15.06. → NICHT
      bu({ betrag: 200, buchung_datum: "2025-06-15" }), // exakt analoger Tag → zählt
      // Bezugsjahr 2026:
      bu({ betrag: 800, buchung_datum: "2026-02-01" }),
    ];
    const aktuell = aktuellAus(buchungen, refDatum, wjBeginn);
    const yoy = berechneYoy(buchungen, aktuell, refDatum, heute, wjBeginn);

    expect(yoy.ist_ytd).toBe(true);
    expect(yoy.vorjahr_jahr).toBe(2025);
    expect(yoy.vorjahr_zeitraum).toEqual({ von: "2025-01-01", bis: "2025-06-15" });
    // Nur bis 15.06.2025: 1000 + 200 = 1200 (9999 ausgeschlossen).
    expect(yoy.vorjahr.einnahmen).toBe(1200);
    expect(aktuell.einnahmen).toBe(800);
    expect(yoy.delta.einnahmen.absolut).toBe(-400);
  });

  it("YTD-Cutoff auf 28.02. geklemmt, wenn heute 29.02. (Schalttag → Nicht-Schaltjahr)", () => {
    const wjBeginn = 1;
    const heute = "2024-02-29"; // Schaltjahr; laufendes WJ 2024
    const refDatum = heute;
    const buchungen = [
      bu({ betrag: 500, buchung_datum: "2023-02-28" }), // <= 28.02.2023 → zählt
      bu({ betrag: 700, buchung_datum: "2023-03-01" }), // danach → NICHT
    ];
    const aktuell = aktuellAus(buchungen, refDatum, wjBeginn);
    const yoy = berechneYoy(buchungen, aktuell, refDatum, heute, wjBeginn);
    expect(yoy.vorjahr_zeitraum.bis).toBe("2023-02-28");
    expect(yoy.vorjahr.einnahmen).toBe(500);
  });
});

// --- leeres Vorjahr (AC1/AC5) -------------------------------------------

describe("berechneYoy — leeres Vorjahr", () => {
  it("Vorjahr ohne Buchungen → alle Werte 0, vorjahr_leer true, Δ ist_neu", () => {
    const wjBeginn = 1;
    const heute = "2026-06-15";
    const refDatum = heute;
    const buchungen = [bu({ betrag: 800, buchung_datum: "2026-02-01" })];
    const aktuell = aktuellAus(buchungen, refDatum, wjBeginn);
    const yoy = berechneYoy(buchungen, aktuell, refDatum, heute, wjBeginn);

    expect(yoy.vorjahr_leer).toBe(true);
    expect(yoy.vorjahr.einnahmen).toBe(0);
    expect(yoy.delta.einnahmen.prozent).toBeNull();
    expect(yoy.delta.einnahmen.ist_neu).toBe(true);
  });

  it("komplett leere Eingabe → kein Crash, alles 0, vorjahr_leer true", () => {
    const yoy = berechneYoy([], { einnahmen: 0, ausgaben: 0, ust_zahllast: 0, gewinn: 0 }, "2026-06-15", "2026-06-15", 1);
    expect(yoy.vorjahr_leer).toBe(true);
    expect(yoy.delta.gewinn.absolut).toBe(0);
    expect(yoy.delta.gewinn.ist_neu).toBe(false);
  });
});

// --- USt-/Gewinn-Logik konsistent zu berechneJahresKennzahlen -----------

describe("berechneYoy — USt-/Gewinn-Logik identisch zum Jahres-Aggregat", () => {
  it("USt-Zahllast + Gewinn des Vorjahres exakt wie berechneJahresKennzahlen", () => {
    const wjBeginn = 1;
    const heute = "2027-06-01"; // laufendes WJ 2027 → Bezug 2026 abgeschlossen
    const refDatum = "2026-01-01";
    const vorjahrBuchungen: DashboardBuchung[] = [
      bu({ betrag: 1190, buchung_datum: "2025-01-05", ust_satz: 19 }),
      bu({ betrag: 535, buchung_datum: "2025-03-12", ust_satz: 7 }),
      bu({ betrag: -238, buchung_datum: "2025-03-20", ust_satz: 19 }),
      bu({ betrag: 99, buchung_datum: "2025-06-06", klassifikation: "privat" }),
    ];
    // Referenzberechnung über das Jahres-Aggregat fürs Vorjahr 2025:
    const ref = berechneJahresKennzahlen(vorjahrBuchungen, "2025-01-01", wjBeginn);

    const aktuell: YoyKennzahlen = { einnahmen: 0, ausgaben: 0, ust_zahllast: 0, gewinn: 0 };
    const yoy = berechneYoy(vorjahrBuchungen, aktuell, refDatum, heute, wjBeginn);

    expect(yoy.vorjahr.einnahmen).toBe(ref.einnahmen);
    expect(yoy.vorjahr.ausgaben).toBe(ref.ausgaben);
    expect(yoy.vorjahr.ust_zahllast).toBe(ref.voraussichtliche_ust_zahllast);
    expect(yoy.vorjahr.gewinn).toBe(ref.vorlaeufiger_gewinn);
  });

  it("ignoriert nicht-geschäftliche Buchungen im Vorjahr", () => {
    const wjBeginn = 1;
    const heute = "2027-01-01";
    const refDatum = "2026-01-01";
    const buchungen = [
      bu({ betrag: 1000, buchung_datum: "2025-05-01", klassifikation: "privat" }),
      bu({ betrag: 1000, buchung_datum: "2025-05-02", klassifikation: "unklar" }),
      bu({ betrag: 1000, buchung_datum: "2025-05-03" }), // zählt
    ];
    const yoy = berechneYoy(buchungen, { einnahmen: 0, ausgaben: 0, ust_zahllast: 0, gewinn: 0 }, refDatum, heute, wjBeginn);
    expect(yoy.vorjahr.einnahmen).toBe(1000);
  });
});

// --- abweichendes Wirtschaftsjahr ---------------------------------------

describe("berechneYoy — abweichendes WJ (Beginn April)", () => {
  it("volles Vorjahr-WJ Apr..Mrz bei abgeschlossenem Bezugsjahr", () => {
    const wjBeginn = 4;
    const heute = "2027-08-01"; // laufendes WJ = 2027-04 .. 2028-03
    // Bezug WJ 2026-04 .. 2027-03 (abgeschlossen) → refDatum darin.
    const refDatum = "2026-05-01";
    const buchungen = [
      // Vorjahr-WJ 2025-04 .. 2026-03:
      bu({ betrag: 700, buchung_datum: "2025-04-10" }),
      bu({ betrag: 300, buchung_datum: "2026-02-15" }),
    ];
    const yoy = berechneYoy(buchungen, { einnahmen: 0, ausgaben: 0, ust_zahllast: 0, gewinn: 0 }, refDatum, heute, wjBeginn);
    expect(yoy.ist_ytd).toBe(false);
    expect(yoy.vorjahr_zeitraum).toEqual({ von: "2025-04-01", bis: "2026-03-31" });
    expect(yoy.vorjahr.einnahmen).toBe(1000);
  });

  it("YTD-Schnitt im laufenden abweichenden WJ (Beginn April)", () => {
    const wjBeginn = 4;
    const heute = "2026-07-15"; // laufendes WJ 2026-04 .. 2027-03
    const refDatum = heute;
    const buchungen = [
      // Vorjahr-WJ 2025-04 .. 2026-03; YTD-Cutoff = 2025-07-15:
      bu({ betrag: 400, buchung_datum: "2025-04-20" }), // zählt
      bu({ betrag: 600, buchung_datum: "2025-07-15" }), // analoger Tag → zählt
      bu({ betrag: 9999, buchung_datum: "2025-10-01" }), // danach → NICHT
    ];
    const yoy = berechneYoy(buchungen, { einnahmen: 0, ausgaben: 0, ust_zahllast: 0, gewinn: 0 }, refDatum, heute, wjBeginn);
    expect(yoy.ist_ytd).toBe(true);
    expect(yoy.vorjahr_zeitraum).toEqual({ von: "2025-04-01", bis: "2025-07-15" });
    expect(yoy.vorjahr.einnahmen).toBe(1000);
  });
});
