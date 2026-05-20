// PROJ-14 Abo-Radar-Fix — Unit-Tests für die reine Kern-Algorithmik der
// Wiederkehr-Erkennung. Bewusst ohne Supabase-Mock: nur Datums-/Betrags-
// Logik, deterministisch.

import { describe, it, expect } from "vitest";
import {
  bewerteBetragsStabilitaet,
  bestimmeRichtung,
  erkenneCluster,
  klassifiziereIntervall,
  median,
  modusEmpfaenger,
  tageZwischen,
  type ErkennungsBuchung,
} from "./wiederkehrend-erkennung";

interface TestBuchung extends ErkennungsBuchung {
  id: string;
}

function bu(
  id: string,
  buchung_datum: string,
  betrag: number,
): TestBuchung {
  return { id, buchung_datum, betrag };
}

describe("median", () => {
  it("ungerade Anzahl → mittlerer Wert", () => {
    expect(median([1, 5, 3])).toBe(3);
  });
  it("gerade Anzahl → Mittelwert der beiden mittleren", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("leere Liste → 0", () => {
    expect(median([])).toBe(0);
  });
});

describe("tageZwischen", () => {
  it("ein Monat ≈ 30 Tage", () => {
    expect(tageZwischen("2026-01-01", "2026-01-31")).toBe(30);
  });
  it("gleiches Datum → 0", () => {
    expect(tageZwischen("2026-05-01", "2026-05-01")).toBe(0);
  });
});

describe("klassifiziereIntervall", () => {
  it("monatlich erkennt 30 Tage", () => {
    expect(klassifiziereIntervall(30)?.name).toBe("monatlich");
  });
  it("wöchentlich erkennt 7 Tage", () => {
    expect(klassifiziereIntervall(7)?.name).toBe("woechentlich");
  });
  it("jährlich erkennt 365 Tage", () => {
    expect(klassifiziereIntervall(365)?.name).toBe("jaehrlich");
  });
  it("liefert null bei ungewöhnlichem Abstand", () => {
    expect(klassifiziereIntervall(45)).toBeNull();
  });
});

describe("bewerteBetragsStabilitaet — Ausreißer-Toleranz", () => {
  it("homogene Beträge → kein Ausreißer, relAbw klein", () => {
    const r = bewerteBetragsStabilitaet([100, 102, 98, 101]);
    expect(r).not.toBeNull();
    expect(r!.ausreisser.every((a) => a === false)).toBe(true);
    expect(r!.bereinigt).toBe(false);
    expect(r!.relAbwStabil).toBeLessThan(0.1);
  });

  it("ein Ausreißer in 4 Buchungen wird isoliert (Accenture-Szenario)", () => {
    // 3 stabile ~6000 + 1 Ausreißer 1700
    const r = bewerteBetragsStabilitaet([5934, 6045, 7012, 1698]);
    expect(r).not.toBeNull();
    // Index 3 (1698) muss als Ausreißer markiert sein.
    expect(r!.ausreisser[3]).toBe(true);
    expect(r!.ausreisser.slice(0, 3)).toEqual([false, false, false]);
    expect(r!.anzahlStabil).toBe(3);
    expect(r!.bereinigt).toBe(true);
    expect(r!.relAbwStabil).toBeLessThan(0.3);
  });

  it("zu viele Ausreißer (2 von 4 = 50 %) → null (Mehrheits-Schwelle erreicht)", () => {
    // 2 stabile ~6000 + 2 Ausreißer 1700, 12000
    const r = bewerteBetragsStabilitaet([5934, 6045, 1698, 12500]);
    expect(r).toBeNull();
  });

  it("Median 0 → null (keine sinnvolle Aussage)", () => {
    const r = bewerteBetragsStabilitaet([0, 0, 0]);
    expect(r).toBeNull();
  });

  it("nach Bereinigung weniger als MIN_BUCHUNGEN stabile → null", () => {
    // 3 Buchungen, 1 davon Ausreißer → nur 2 stabile übrig (< MIN_BUCHUNGEN=3)
    const r = bewerteBetragsStabilitaet([100, 105, 5]);
    expect(r).toBeNull();
  });
});

describe("bestimmeRichtung", () => {
  it("Mehrheit positiv → einnahme", () => {
    expect(bestimmeRichtung([100, 102, 98], [false, false, false])).toBe(
      "einnahme",
    );
  });
  it("Mehrheit negativ → ausgabe", () => {
    expect(bestimmeRichtung([-19, -19, -19], [false, false, false])).toBe(
      "ausgabe",
    );
  });
  it("ignoriert Ausreißer-Index", () => {
    // Drei positive (stabile) + ein negativer Ausreißer → einnahme
    expect(
      bestimmeRichtung([5934, 6045, 7012, -1698], [false, false, false, true]),
    ).toBe("einnahme");
  });
});

describe("modusEmpfaenger", () => {
  it("liefert die häufigste Variante", () => {
    expect(
      modusEmpfaenger(["Accenture GmbH", "Accenture GmbH", "ACCENTURE"]),
    ).toBe("Accenture GmbH");
  });
  it("ignoriert null und leere Strings", () => {
    expect(modusEmpfaenger([null, "  ", "ACME", "ACME"])).toBe("ACME");
  });
  it("leere Liste → leerer String", () => {
    expect(modusEmpfaenger([])).toBe("");
  });
});

describe("erkenneCluster — End-to-End", () => {
  it("Cluster mit 4 Einnahmen-Buchungen wird als 'einnahme' erkannt", () => {
    const b = [
      bu("g1", "2026-02-01", 6000),
      bu("g2", "2026-03-01", 6000),
      bu("g3", "2026-04-01", 6000),
      bu("g4", "2026-05-01", 6000),
    ];
    const c = erkenneCluster(b);
    expect(c).not.toBeNull();
    expect(c!.richtung).toBe("einnahme");
    expect(c!.intervall).toBe("monatlich");
    expect(c!.betrag_median).toBe(6000);
    expect(c!.jahresvolumen).toBe(72000);
    expect(c!.anzahl).toBe(4);
    expect(c!.anzahl_ausreisser).toBe(0);
  });

  it("Cluster mit Ausreißer (3× ~6000 + 1× 1700) wird trotzdem erkannt", () => {
    const b = [
      bu("g1", "2026-02-01", 5934),
      bu("g2", "2026-03-01", 6045),
      bu("g3", "2026-04-01", 7012),
      bu("g4", "2026-05-01", 1698), // Ausreißer
    ];
    const c = erkenneCluster(b);
    expect(c).not.toBeNull();
    expect(c!.richtung).toBe("einnahme");
    expect(c!.intervall).toBe("monatlich");
    // Median der stabilen 3 ≈ 6045
    expect(c!.betrag_median).toBeCloseTo(6045, 0);
    // Ausreißer-Flag auf der letzten Buchung
    const flagged = c!.buchungen.find((x) => x.id === "g4");
    expect(flagged?.ausreisser).toBe(true);
    expect(c!.anzahl_ausreisser).toBe(1);
    // Konfidenz wird wegen Bereinigung leicht gedämpft
    expect(c!.konfidenz).toBeLessThan(0.9);
  });

  it("Cluster mit ≥ 50 % Ausreißern (2 von 4) wird verworfen", () => {
    const b = [
      bu("b1", "2026-02-01", 6000),
      bu("b2", "2026-03-01", 6000),
      bu("b3", "2026-04-01", 1500), // Ausreißer 1
      bu("b4", "2026-05-01", 12500), // Ausreißer 2
    ];
    const c = erkenneCluster(b);
    expect(c).toBeNull();
  });

  it("Cluster mit Ausgaben → richtung='ausgabe', betrag_median positiv", () => {
    const b = [
      bu("n1", "2026-02-01", -19.99),
      bu("n2", "2026-03-01", -19.99),
      bu("n3", "2026-04-01", -19.99),
    ];
    const c = erkenneCluster(b);
    expect(c).not.toBeNull();
    expect(c!.richtung).toBe("ausgabe");
    // betrag_median ist |betrag|
    expect(c!.betrag_median).toBeCloseTo(19.99, 2);
  });

  it("weniger als MIN_BUCHUNGEN → null", () => {
    const b = [bu("x1", "2026-02-01", 100), bu("x2", "2026-03-01", 100)];
    expect(erkenneCluster(b)).toBeNull();
  });

  it("ungewöhnlicher Rhythmus → null", () => {
    const b = [
      bu("u1", "2026-01-01", 100),
      bu("u2", "2026-02-15", 100),
      bu("u3", "2026-04-22", 100),
    ];
    // Abstände ~45 und ~66 Tage → keinem Profil zugeordnet
    expect(erkenneCluster(b)).toBeNull();
  });
});
