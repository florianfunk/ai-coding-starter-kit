import { describe, it, expect } from "vitest";
import {
  bereitePerioden,
  berechneJahresKennzahlen,
  laufendesWirtschaftsjahr,
  periodenLabel,
  rundeCent,
  syncStatusAus,
  zaehleAktionen,
  type DashboardBuchung,
} from "./aggregate";

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

// --- rundeCent -----------------------------------------------------------

describe("rundeCent", () => {
  it("rundet cent-genau und vermeidet Float-Drift", () => {
    expect(rundeCent(0.1 + 0.2)).toBe(0.3);
    expect(rundeCent(2.005)).toBe(2.01);
    expect(rundeCent(-2.005)).toBe(-2.01);
  });
});

// --- laufendesWirtschaftsjahr -------------------------------------------

describe("laufendesWirtschaftsjahr", () => {
  it("Kalenderjahr (Beginn Januar)", () => {
    expect(laufendesWirtschaftsjahr("2026-05-15", 1)).toEqual({
      jahr: 2026,
      von: "2026-01-01",
      bis: "2026-12-31",
    });
  });

  it("abweichendes WJ (Beginn Juli): Mai liegt im WJ, das im Vorjahr begann", () => {
    expect(laufendesWirtschaftsjahr("2026-05-15", 7)).toEqual({
      jahr: 2025,
      von: "2025-07-01",
      bis: "2026-06-30",
    });
  });

  it("abweichendes WJ (Beginn Juli): August liegt im WJ desselben Jahres", () => {
    expect(laufendesWirtschaftsjahr("2026-08-01", 7)).toEqual({
      jahr: 2026,
      von: "2026-07-01",
      bis: "2027-06-30",
    });
  });

  it("ungültiger WJ-Beginn fällt auf Kalenderjahr zurück", () => {
    expect(laufendesWirtschaftsjahr("2026-05-15", 0)).toEqual({
      jahr: 2026,
      von: "2026-01-01",
      bis: "2026-12-31",
    });
    expect(laufendesWirtschaftsjahr("2026-05-15", 13)).toEqual({
      jahr: 2026,
      von: "2026-01-01",
      bis: "2026-12-31",
    });
  });
});

// --- zaehleAktionen ------------------------------------------------------

describe("zaehleAktionen", () => {
  it("zählt Prüffälle, fehlende Belege und unklassifizierte korrekt", () => {
    const buchungen: DashboardBuchung[] = [
      bu({ status: "zur_pruefung" }),
      bu({ status: "zur_pruefung" }),
      bu({ status: "offen", klassifikation: null }),
      bu({ klassifikation: "geschaeftlich", belegt: false }),
      bu({ klassifikation: "geschaeftlich", belegt: true }),
      // privat ohne Beleg zählt NICHT als fehlender Beleg:
      bu({ klassifikation: "privat", belegt: false }),
    ];
    expect(zaehleAktionen(buchungen)).toEqual({
      offene_prueffaelle: 2,
      fehlende_belege: 1,
      unklassifiziert: 1,
    });
  });

  it("liefert für leere Daten Nullwerte", () => {
    expect(zaehleAktionen([])).toEqual({
      offene_prueffaelle: 0,
      fehlende_belege: 0,
      unklassifiziert: 0,
    });
  });
});

// --- berechneJahresKennzahlen -------------------------------------------

describe("berechneJahresKennzahlen", () => {
  it("summiert nur geschäftliche Buchungen im laufenden WJ", () => {
    const buchungen: DashboardBuchung[] = [
      bu({ betrag: 1000, buchung_datum: "2026-03-01" }),
      bu({ betrag: -400, buchung_datum: "2026-04-01" }),
      // außerhalb des Jahres:
      bu({ betrag: 9999, buchung_datum: "2025-12-31" }),
      // privat → ausgeschlossen:
      bu({ betrag: 500, buchung_datum: "2026-02-01", klassifikation: "privat" }),
      // unklassifiziert → ausgeschlossen:
      bu({ betrag: 700, buchung_datum: "2026-02-01", klassifikation: null }),
    ];
    const r = berechneJahresKennzahlen(buchungen, "2026-05-15", 1);
    expect(r.einnahmen).toBe(1000);
    expect(r.ausgaben).toBe(400);
    expect(r.vorlaeufiger_gewinn).toBe(600);
    expect(r.anzahl_buchungen).toBe(2);
    expect(r.vorlaeufig).toBe(true);
    expect(r.zeitraum).toEqual({ von: "2026-01-01", bis: "2026-12-31" });
  });

  it("schätzt voraussichtliche USt-Zahllast (USt auf Einnahmen − Vorsteuer belegter Ausgaben)", () => {
    const buchungen: DashboardBuchung[] = [
      // 1190 brutto @19% → enthaltene USt = 190
      bu({ betrag: 1190, buchung_datum: "2026-03-01", ust_satz: 19 }),
      // belegte Ausgabe 119 brutto @19% → Vorsteuer = 19
      bu({
        betrag: -119,
        buchung_datum: "2026-03-05",
        ust_satz: 19,
        belegt: true,
      }),
      // unbelegte Ausgabe → keine Vorsteuer
      bu({
        betrag: -119,
        buchung_datum: "2026-03-06",
        ust_satz: 19,
        belegt: false,
      }),
    ];
    const r = berechneJahresKennzahlen(buchungen, "2026-05-15", 1);
    expect(r.voraussichtliche_ust_zahllast).toBe(171);
  });

  it("liefert für leere Daten Nullsummen mit korrektem Zeitraum", () => {
    const r = berechneJahresKennzahlen([], "2026-05-15", 7);
    expect(r.einnahmen).toBe(0);
    expect(r.ausgaben).toBe(0);
    expect(r.vorlaeufiger_gewinn).toBe(0);
    expect(r.voraussichtliche_ust_zahllast).toBe(0);
    expect(r.anzahl_buchungen).toBe(0);
    expect(r.zeitraum).toEqual({ von: "2025-07-01", bis: "2026-06-30" });
  });

  it("kennzeichnet Verlust als negativen vorläufigen Gewinn", () => {
    const buchungen: DashboardBuchung[] = [
      bu({ betrag: 1000, buchung_datum: "2026-03-01" }),
      bu({ betrag: -2500, buchung_datum: "2026-04-01" }),
    ];
    const r = berechneJahresKennzahlen(buchungen, "2026-05-15", 1);
    expect(r.vorlaeufiger_gewinn).toBe(-1500);
  });
});

// --- syncStatusAus -------------------------------------------------------

describe("syncStatusAus", () => {
  it("markiert fehlerhaften letzten Lauf", () => {
    const s = syncStatusAus({
      status: "fehler",
      created_at: "2026-05-14T10:00:00Z",
      fehler_text: "Timeout",
    });
    expect(s).toEqual({
      vorhanden: true,
      status: "fehler",
      zeitpunkt: "2026-05-14T10:00:00Z",
      fehler_text: "Timeout",
      ist_fehler: true,
    });
  });

  it("gibt bei fehlendem Lauf einen leeren Status zurück", () => {
    expect(syncStatusAus(null)).toEqual({
      vorhanden: false,
      status: null,
      zeitpunkt: null,
      fehler_text: null,
      ist_fehler: false,
    });
  });

  it("unterdrückt fehler_text bei erfolgreichem Lauf", () => {
    const s = syncStatusAus({
      status: "fertig",
      created_at: "2026-05-14T10:00:00Z",
      fehler_text: "alter Fehler",
    });
    expect(s.ist_fehler).toBe(false);
    expect(s.fehler_text).toBeNull();
  });
});

// --- Perioden ------------------------------------------------------------

describe("periodenLabel & bereitePerioden", () => {
  it("erzeugt deutsche Labels je Art/Periode", () => {
    expect(periodenLabel("wirtschaftsjahr", 2025, null)).toBe(
      "Wirtschaftsjahr 2025",
    );
    expect(periodenLabel("ust_va", 2026, 3)).toBe("USt-VA Mär 2026");
    expect(periodenLabel("ust_va", 2026, 0)).toBe("USt-VA Jahr 2026");
  });

  it("sortiert neueste zuerst, Wirtschaftsjahr vor USt-VA bei gleichem Jahr", () => {
    const sortiert = bereitePerioden([
      { art: "ust_va", jahr: 2025, periode: 12, status: "offen" },
      { art: "ust_va", jahr: 2026, periode: 1, status: "offen" },
      { art: "wirtschaftsjahr", jahr: 2026, periode: null, status: "geprueft" },
    ]);
    expect(sortiert.map((p) => p.label)).toEqual([
      "Wirtschaftsjahr 2026",
      "USt-VA Jan 2026",
      "USt-VA Dez 2025",
    ]);
  });
});
