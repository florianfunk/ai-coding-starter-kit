import { describe, it, expect } from "vitest";
import {
  bewerteMatch,
  betragScore,
  datumScore,
  empfaengerScore,
  textScore,
  normalisiere,
  tokenize,
  tageDifferenz,
  DEFAULT_SCORE_CONFIG,
  type BelegFuerScore,
  type BuchungFuerScore,
} from "./score";

const cfg = DEFAULT_SCORE_CONFIG;

function buchung(over: Partial<BuchungFuerScore> = {}): BuchungFuerScore {
  return {
    id: "b1",
    betrag: -119.0,
    buchung_datum: "2026-03-15",
    verwendungszweck: "Rechnung Buero Mueller GmbH Nr 4711",
    empfaenger: "Bürobedarf Müller GmbH",
    ...over,
  };
}

function beleg(over: Partial<BelegFuerScore> = {}): BelegFuerScore {
  return {
    id: "r1",
    betrag: 119.0,
    beleg_datum: "2026-03-14",
    titel: "Rechnung 4711 Büromaterial",
    korrespondent: "Bürobedarf Müller GmbH",
    ocr_text: "Rechnung Nummer 4711 Büromaterial Stifte Papier",
    ...over,
  };
}

describe("normalisiere/tokenize", () => {
  it("entfernt Diakritika, Sonderzeichen und lowercased", () => {
    expect(normalisiere("Müller & Söhne GmbH!")).toBe("mueller soehne gmbh");
  });

  it("tokenize verwirft Tokens kürzer als 2 Zeichen", () => {
    expect(tokenize("a B12 cd")).toEqual(["b12", "cd"]);
  });
});

describe("tageDifferenz", () => {
  it("liefert absolute Tagesdifferenz", () => {
    expect(tageDifferenz("2026-03-01", "2026-03-15")).toBe(14);
    expect(tageDifferenz("2026-03-15", "2026-03-01")).toBe(14);
  });

  it("liefert NaN bei ungültigem Datum", () => {
    expect(Number.isNaN(tageDifferenz("kaputt", "2026-03-01"))).toBe(true);
  });
});

describe("betragScore — Toleranz", () => {
  it("exakter Betrag (mit Vorzeichenunterschied) → 1.0", () => {
    const r = betragScore(-119.0, 119.0, cfg);
    expect(r.score).toBe(1);
  });

  it("innerhalb absoluter Toleranz (Skonto 0,30 €) → 1.0", () => {
    const r = betragScore(-118.7, 119.0, cfg);
    expect(r.score).toBe(1);
  });

  it("innerhalb relativer 2%-Toleranz bei großem Betrag → 1.0", () => {
    // 2 % von 5000 = 100; Δ 80 liegt innerhalb
    const r = betragScore(-4920, 5000, cfg);
    expect(r.score).toBe(1);
  });

  it("stark abweichender Betrag → 0", () => {
    const r = betragScore(-50, 500, cfg);
    expect(r.score).toBe(0);
  });

  it("knapp außerhalb Toleranz → Teilscore zwischen 0 und 1", () => {
    // toleranz = max(0.5, 119*0.02=2.38) = 2.38; Δ = 3 liegt zwischen t und 2t
    const r = betragScore(-122, 119, cfg);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(1);
  });

  it("kein Belegbetrag → 0", () => {
    expect(betragScore(-119, null, cfg).score).toBe(0);
  });
});

describe("datumScore — Fenster", () => {
  it("gleiches Datum → 1.0", () => {
    expect(datumScore("2026-03-15", "2026-03-15", cfg).score).toBe(1);
  });

  it("innerhalb halbem Fenster (5 Tage) → 1.0", () => {
    expect(datumScore("2026-03-15", "2026-03-10", cfg).score).toBe(1);
  });

  it("am Fensterrand (14 Tage) → > 0 aber < 1", () => {
    const r = datumScore("2026-03-15", "2026-03-01", cfg);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThan(1);
  });

  it("außerhalb Fenster (40 Tage) → 0", () => {
    expect(datumScore("2026-03-15", "2026-02-03", cfg).score).toBe(0);
  });

  it("kein Belegdatum → 0", () => {
    expect(datumScore("2026-03-15", null, cfg).score).toBe(0);
  });
});

describe("empfaengerScore", () => {
  it("identischer Empfänger → 1.0", () => {
    expect(
      empfaengerScore("Müller GmbH", "Mueller  GmbH", cfg).score,
    ).toBe(1);
  });

  it("Teilstring → hoher Score", () => {
    const r = empfaengerScore("Müller GmbH Berlin", "Müller GmbH", cfg);
    expect(r.score).toBeGreaterThanOrEqual(0.9);
  });

  it("völlig verschieden → niedrig", () => {
    expect(empfaengerScore("Telekom AG", "Bäckerei Schmidt", cfg).score).toBe(
      0,
    );
  });
});

describe("textScore", () => {
  it("gemeinsame Tokens → > 0", () => {
    const r = textScore(
      { verwendungszweck: "Rechnung 4711 Büromaterial" },
      {
        titel: "Rechnung 4711 Büromaterial",
        korrespondent: null,
        ocr_text: null,
      },
      cfg,
    );
    expect(r.score).toBeGreaterThan(0.5);
  });

  it("ohne Verwendungszweck → 0", () => {
    const r = textScore(
      { verwendungszweck: null },
      { titel: "x", korrespondent: null, ocr_text: null },
      cfg,
    );
    expect(r.score).toBe(0);
  });
});

describe("bewerteMatch — Gesamtscore + Einordnung", () => {
  it("idealer Treffer → eindeutig (>= 0.85)", () => {
    const r = bewerteMatch(buchung(), beleg());
    expect(r.score).toBeGreaterThanOrEqual(0.85);
    expect(r.einordnung).toBe("eindeutig");
  });

  it("nur Betrag passt, Rest weit weg → kein_match (< 0.5)", () => {
    const r = bewerteMatch(
      buchung({
        empfaenger: "Fremdfirma XYZ",
        verwendungszweck: "Irgendwas anderes",
        buchung_datum: "2026-01-01",
      }),
      beleg({
        beleg_datum: "2026-09-01",
        korrespondent: "Ganz andere Firma",
        titel: "Komplett anderer Text",
        ocr_text: "nichts gemeinsam hier",
      }),
    );
    expect(r.score).toBeLessThan(0.5);
    expect(r.einordnung).toBe("kein_match");
  });

  it("Score liegt immer in [0,1]", () => {
    const r = bewerteMatch(buchung(), beleg());
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it("Kriterien-Breakdown ist vollständig und nachvollziehbar", () => {
    const r = bewerteMatch(buchung(), beleg());
    for (const key of ["betrag", "datum", "empfaenger", "text"] as const) {
      expect(typeof r.kriterien[key].score).toBe("number");
      expect(typeof r.kriterien[key].detail).toBe("string");
      expect(r.kriterien[key].detail.length).toBeGreaterThan(0);
    }
  });

  it("konfigurierbares Datumsfenster wirkt", () => {
    const b = buchung({ buchung_datum: "2026-03-15" });
    const r = beleg({ beleg_datum: "2026-02-20" }); // 23 Tage
    const eng = bewerteMatch(b, r); // 14-Tage-Fenster → Datum 0
    const weit = bewerteMatch(b, r, {
      ...DEFAULT_SCORE_CONFIG,
      datum_fenster_tage: 60,
    });
    expect(weit.kriterien.datum.score).toBeGreaterThan(
      eng.kriterien.datum.score,
    );
  });
});
