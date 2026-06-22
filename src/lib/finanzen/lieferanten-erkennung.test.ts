// PROJ-18 — Unit-Tests für die reine Lieferanten-Aggregation. Wie bei
// wiederkehrend-erkennung.test.ts: kein Supabase, deterministisch.

import { describe, it, expect } from "vitest";
import type { KategorieTyp, Klassifikation } from "@/lib/types";
import {
  bestimmeDominanteKategorie,
  bestimmeDominanteKlassifikation,
  erkenneLieferanten,
  gruppiereNachEmpfaenger,
  type LieferantenBuchung,
} from "./lieferanten-erkennung";

function bu(
  id: string,
  empfaenger_normalisiert: string | null,
  empfaenger: string | null,
  buchung_datum: string,
  betrag: number,
): LieferantenBuchung {
  return {
    id,
    empfaenger_normalisiert,
    empfaenger,
    buchung_datum,
    betrag,
    klassifikation: null,
    kategorie_id: null,
    konto_id: "k1",
    status: "auto_verbucht",
  };
}

describe("gruppiereNachEmpfaenger", () => {
  it("gruppiert nach empfaenger_normalisiert", () => {
    const result = gruppiereNachEmpfaenger([
      bu("1", "aldi", "ALDI SUED", "2026-01-01", -10),
      bu("2", "aldi", "ALDI Süd", "2026-01-15", -12),
      bu("3", "rewe", "REWE", "2026-01-10", -8),
    ]);
    expect(result.size).toBe(2);
    expect(result.get("aldi")?.length).toBe(2);
    expect(result.get("rewe")?.length).toBe(1);
  });

  it("Fallback auf normalisiereEmpfaenger bei leerem empfaenger_normalisiert", () => {
    // Bei leerem/null empfaenger_normalisiert greift der Fallback und
    // berechnet den Schlüssel aus `empfaenger`. Zwei Buchungen mit
    // demselben Roh-Empfänger landen unter demselben Schlüssel.
    const result = gruppiereNachEmpfaenger([
      bu("1", "", "ALDI SUED", "2026-01-01", -10),
      bu("2", null, "ALDI SUED", "2026-01-15", -12),
    ]);
    expect(result.size).toBe(1);
    const keys = Array.from(result.keys());
    expect(keys[0]).toContain("aldi");
  });

  it("ignoriert Buchungen ohne Empfänger-Info", () => {
    const result = gruppiereNachEmpfaenger([
      bu("1", null, null, "2026-01-01", -10),
      bu("2", "", "", "2026-01-15", -12),
    ]);
    expect(result.size).toBe(0);
  });
});

describe("bestimmeDominanteKlassifikation", () => {
  it("alle privat → privat", () => {
    expect(bestimmeDominanteKlassifikation(["privat", "privat", "privat"])).toBe(
      "privat",
    );
  });
  it("alle geschäftlich → geschäftlich", () => {
    expect(
      bestimmeDominanteKlassifikation([
        "geschaeftlich",
        "geschaeftlich",
        "geschaeftlich",
      ]),
    ).toBe("geschaeftlich");
  });
  it("≥ 80% privat → privat", () => {
    expect(
      bestimmeDominanteKlassifikation([
        "privat",
        "privat",
        "privat",
        "privat",
        "geschaeftlich",
      ]),
    ).toBe("privat");
  });
  it("Mischverhältnis < 80% → unklar", () => {
    expect(
      bestimmeDominanteKlassifikation([
        "privat",
        "privat",
        "geschaeftlich",
        "geschaeftlich",
      ]),
    ).toBe("unklar");
  });
  it("null/unklar/neutral zählen nicht für die Mehrheit", () => {
    expect(
      bestimmeDominanteKlassifikation([null, "unklar", "neutral", "privat"]),
    ).toBe("unklar");
  });
  it("leere Liste → unklar", () => {
    expect(bestimmeDominanteKlassifikation([])).toBe("unklar");
  });
});

describe("bestimmeDominanteKategorie", () => {
  it("häufigste kategorie_id mit Anteil", () => {
    const result = bestimmeDominanteKategorie([
      "kat-a",
      "kat-a",
      "kat-a",
      "kat-b",
      null,
    ]);
    expect(result).toEqual({ id: "kat-a", anzahl: 3, anteil: 0.6 });
  });
  it("alle null → null", () => {
    expect(bestimmeDominanteKategorie([null, null, null])).toBeNull();
  });
  it("leere Liste → null", () => {
    expect(bestimmeDominanteKategorie([])).toBeNull();
  });
});

function buFull(
  id: string,
  empfaenger_normalisiert: string,
  empfaenger: string,
  buchung_datum: string,
  betrag: number,
  klassifikation: Klassifikation | null = null,
  kategorie_id: string | null = null,
  kategorie_typ: KategorieTyp | null = null,
): LieferantenBuchung {
  return {
    id,
    empfaenger_normalisiert,
    empfaenger,
    buchung_datum,
    betrag,
    klassifikation,
    kategorie_id,
    kategorie_typ,
    konto_id: "k1",
    status: "auto_verbucht",
  };
}

describe("erkenneLieferanten", () => {
  it("Aldi mit 5 schwankenden Beträgen → Lieferant", () => {
    const buchungen = [
      buFull("1", "aldi", "ALDI SUED", "2026-01-03", -23.5),
      buFull("2", "aldi", "ALDI SUED", "2026-01-19", -41.2),
      buFull("3", "aldi", "ALDI Süd", "2026-02-04", -18.0),
      buFull("4", "aldi", "ALDI", "2026-02-22", -67.4),
      buFull("5", "aldi", "ALDI SÜD", "2026-03-09", -29.9),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items.length).toBe(1);
    expect(items[0].empfaenger_norm).toBe("aldi");
    expect(items[0].anzahl).toBe(5);
    expect(items[0].richtung).toBe("ausgabe");
  });

  it("Netflix monatlich gleicher Betrag → Lieferant MIT Abo-Markierung", () => {
    // PROJ-18 (2026-06-15): Abos werden nicht mehr aus dem Lieferanten-Tab
    // ausgeschlossen, sondern als Abo markiert (sie erscheinen zusätzlich im
    // Abo-Radar). So fehlen wiederkehrende Empfänger wie Scalable/NinjaOne
    // nicht mehr in der Lieferanten-Liste.
    const buchungen = [
      buFull("1", "netflix", "NETFLIX", "2026-01-15", -12.99),
      buFull("2", "netflix", "NETFLIX", "2026-02-15", -12.99),
      buFull("3", "netflix", "NETFLIX", "2026-03-15", -12.99),
      buFull("4", "netflix", "NETFLIX", "2026-04-15", -12.99),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items.length).toBe(1);
    expect(items[0].empfaenger_norm).toBe("netflix");
    expect(items[0].abo).not.toBeNull();
    expect(items[0].abo?.intervall).toBe("monatlich");
  });

  it("Aldi mit schwankenden Beträgen → Lieferant OHNE Abo-Markierung", () => {
    const buchungen = [
      buFull("1", "aldi", "ALDI SUED", "2026-01-03", -23.5),
      buFull("2", "aldi", "ALDI SUED", "2026-01-19", -41.2),
      buFull("3", "aldi", "ALDI Süd", "2026-02-04", -18.0),
      buFull("4", "aldi", "ALDI", "2026-02-22", -67.4),
      buFull("5", "aldi", "ALDI SÜD", "2026-03-09", -29.9),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items[0].abo).toBeNull();
  });

  it("MediaMarkt mit 2 Buchungen → unter Schwelle, NICHT als Lieferant", () => {
    const buchungen = [
      buFull("1", "mediamarkt", "MediaMarkt", "2026-01-03", -899),
      buFull("2", "mediamarkt", "MediaMarkt", "2026-04-19", -1499),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items.length).toBe(0);
  });

  it("dominante Klassifikation aus Buchungen ableiten", () => {
    const buchungen = [
      buFull("1", "aldi", "ALDI", "2026-01-03", -23.5, "privat"),
      buFull("2", "aldi", "ALDI", "2026-01-19", -41.2, "privat"),
      buFull("3", "aldi", "ALDI", "2026-02-04", -18.0, "privat"),
      buFull("4", "aldi", "ALDI", "2026-02-22", -67.4, "privat"),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items[0].dominante_klassifikation).toBe("privat");
  });

  it("gemischte Klassifikation < 80% → unklar", () => {
    const buchungen = [
      buFull("1", "aldi", "ALDI", "2026-01-03", -23.5, "privat"),
      buFull("2", "aldi", "ALDI", "2026-01-19", -41.2, "geschaeftlich"),
      buFull("3", "aldi", "ALDI", "2026-02-04", -18.0, "privat"),
      buFull("4", "aldi", "ALDI", "2026-02-22", -67.4, "geschaeftlich"),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items[0].dominante_klassifikation).toBe("unklar");
  });

  it("Jahresumsatz wird hochgerechnet bei Span < 365 Tagen", () => {
    // 4 Buchungen über ~60 Tage, Gesamtsumme 150 EUR
    // Span ≈ 60, hochgerechnet ≈ 150 * 365 / 60 ≈ 912
    const buchungen = [
      buFull("1", "aldi", "ALDI", "2026-01-01", -30),
      buFull("2", "aldi", "ALDI", "2026-01-20", -50),
      buFull("3", "aldi", "ALDI", "2026-02-10", -20),
      buFull("4", "aldi", "ALDI", "2026-03-02", -50),
    ];
    const items = erkenneLieferanten(buchungen);
    // Netto-Summe vorzeichenbehaftet: vier Ausgaben → -150 EUR.
    expect(items[0].gesamt_summe).toBe(-150);
    // Jahres-Hochrechnung behält das Vorzeichen (Ausgabe → negativ).
    expect(items[0].jahresumsatz).toBeLessThan(-150);
    expect(items[0].jahresumsatz).toBeGreaterThan(-1100);
  });

  it("neutrale Geldtransit-Buchungen zählen NICHT für Richtung & dominante Kategorie", () => {
    // PayPal-Fall: viele neutrale Umbuchungen (Geldtransit, hier Zuflüsse),
    // dazu echte private Ausgaben. Richtung und Badge sollen nur die
    // steuerlich relevanten (nicht-neutralen) Buchungen beschreiben.
    const buchungen = [
      buFull("1", "paypal", "PayPal", "2026-01-03", 100, "neutral", "kat-gt", "neutral"),
      buFull("2", "paypal", "PayPal", "2026-01-10", 100, "neutral", "kat-gt", "neutral"),
      buFull("3", "paypal", "PayPal", "2026-01-17", 100, "neutral", "kat-gt", "neutral"),
      buFull("4", "paypal", "PayPal", "2026-02-01", -20, "privat", "kat-priv", "privat"),
      buFull("5", "paypal", "PayPal", "2026-03-01", -20, "privat", "kat-priv", "privat"),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items.length).toBe(1);
    // Ohne Ausschluss wären 3 Zuflüsse die Mehrheit → "einnahme".
    // Mit Ausschluss bleiben nur die zwei privaten Abflüsse → "ausgabe".
    expect(items[0].richtung).toBe("ausgabe");
    // Geldtransit (3×) wäre häufigste Kategorie; ausgeschlossen gewinnt
    // die private Kategorie (2× von 2 relevanten → Anteil 1).
    expect(items[0].dominante_kategorie?.id).toBe("kat-priv");
    expect(items[0].dominante_kategorie?.anteil).toBe(1);
  });

  it("rein neutraler Empfänger → Fallback auf volle Gruppe", () => {
    // Empfänger mit ausschließlich Geldtransit: kein steuerrelevanter Rest,
    // daher Fallback auf die volle Gruppe statt leerer Signale.
    const buchungen = [
      buFull("1", "umbuchung", "Umbuchung", "2026-01-03", 100, "neutral", "kat-gt", "neutral"),
      buFull("2", "umbuchung", "Umbuchung", "2026-01-20", 100, "neutral", "kat-gt", "neutral"),
      buFull("3", "umbuchung", "Umbuchung", "2026-02-15", 100, "neutral", "kat-gt", "neutral"),
    ];
    const items = erkenneLieferanten(buchungen);
    expect(items.length).toBe(1);
    expect(items[0].richtung).toBe("einnahme");
    expect(items[0].dominante_kategorie?.id).toBe("kat-gt");
  });

  it("Jahresumsatz wird NICHT unter Gesamtsumme gekappt", () => {
    // Span > 365 Tage → jahresumsatz darf < gesamt_summe sein (proportional)
    const buchungen = [
      buFull("1", "aldi", "ALDI", "2024-01-01", -100),
      buFull("2", "aldi", "ALDI", "2024-06-01", -100),
      buFull("3", "aldi", "ALDI", "2025-06-01", -100),
      buFull("4", "aldi", "ALDI", "2026-01-01", -100),
    ];
    const items = erkenneLieferanten(buchungen);
    // Netto-Summe vorzeichenbehaftet: vier Ausgaben → -400 EUR.
    expect(items[0].gesamt_summe).toBe(-400);
    // Span ~730 Tage, also jahresumsatz ~-200 (Vorzeichen erhalten).
    expect(items[0].jahresumsatz).toBeGreaterThan(-400);
    expect(items[0].jahresumsatz).toBeLessThan(-100);
  });
});
