import { describe, it, expect } from "vitest";
import { berechneHealthScore, type HealthScoreArgs } from "./health-score";

function args(over: Partial<HealthScoreArgs> = {}): HealthScoreArgs {
  return {
    gesamt_buchungen: 100,
    unklassifiziert: 0,
    offene_prueffaelle: 0,
    geschaeftlich_gesamt: 50,
    fehlende_belege: 0,
    sync_fehler: false,
    fristen_ampel: null,
    ...over,
  };
}

describe("berechneHealthScore — perfekter Stand", () => {
  it("liefert 100 und Klartext ohne offene Punkte", () => {
    const r = berechneHealthScore(args());
    expect(r.score).toBe(100);
    expect(r.ist_leer).toBe(false);
    expect(r.klartext).toContain("vollständig auf Stand");
    // Summe der Beiträge = 100.
    const summe = r.komponenten.reduce((s, k) => s + k.beitrag, 0);
    expect(summe).toBe(100);
  });
});

describe("berechneHealthScore — viele offene Punkte", () => {
  it("senkt den Score deutlich", () => {
    const r = berechneHealthScore(
      args({
        gesamt_buchungen: 100,
        unklassifiziert: 100, // 0 % klassifiziert → 0 von 30
        offene_prueffaelle: 100, // 0 % → 0 von 20
        geschaeftlich_gesamt: 50,
        fehlende_belege: 50, // 0 % belegt → 0 von 25
      }),
    );
    // Nur Sync (10) + Fristen (15, ampel null) bleiben → 25.
    expect(r.score).toBe(25);
    expect(r.klartext).toContain("unklassifiziert");
    expect(r.klartext).toContain("zu prüfen");
    expect(r.klartext).toContain("ohne Beleg");
  });
});

describe("berechneHealthScore — Sync-Fehler", () => {
  it("zieht die volle Sync-Komponente ab", () => {
    const perfekt = berechneHealthScore(args());
    const mitFehler = berechneHealthScore(args({ sync_fehler: true }));
    expect(mitFehler.score).toBe((perfekt.score ?? 0) - 10);
    expect(mitFehler.klartext).toContain("Sync-Fehler");
  });
});

describe("berechneHealthScore — Fristen-Ampel", () => {
  it("rot zieht die volle Fristen-Komponente, gelb die Hälfte", () => {
    const rot = berechneHealthScore(args({ fristen_ampel: "rot" }));
    const gelb = berechneHealthScore(args({ fristen_ampel: "gelb" }));
    const neutral = berechneHealthScore(args({ fristen_ampel: "neutral" }));
    expect(neutral.score).toBe(100);
    // Score wird auf der ROHsumme gerundet: 92.5 → 93 (15 * 0.5 = 7.5 Abzug).
    expect(gelb.score).toBe(93);
    expect(rot.score).toBe(100 - 15);
  });
});

describe("berechneHealthScore — leerer Zustand", () => {
  it("gibt score=null mit Hinweis bei 0 Buchungen", () => {
    const r = berechneHealthScore(args({ gesamt_buchungen: 0 }));
    expect(r.score).toBeNull();
    expect(r.ist_leer).toBe(true);
    expect(r.klartext).toContain("Noch keine Buchungen");
  });
});

describe("berechneHealthScore — keine geschäftlichen Buchungen", () => {
  it("wertet die Belege-Komponente als voll (kein Beleg nötig)", () => {
    const r = berechneHealthScore(
      args({ geschaeftlich_gesamt: 0, fehlende_belege: 0 }),
    );
    expect(r.score).toBe(100);
  });
});
