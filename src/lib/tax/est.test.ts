import { describe, it, expect } from "vitest";
import {
  berechneEst,
  rundeCent,
  seedTarif,
  type EstEingabe,
  type EstTarif,
} from "./est";

// --- Fixtures ------------------------------------------------------------

const TARIF_2024: EstTarif = seedTarif(2024).tarif;
const TARIF_2025: EstTarif = seedTarif(2025).tarif;

function eingabe(over: Partial<EstEingabe> = {}): EstEingabe {
  return {
    jahr: 2024,
    euer_gewinn: 0,
    weitere_einkuenfte: 0,
    vorauszahlungen: 0,
    veranlagung: "einzel",
    ...over,
  };
}

// Referenz-Tarif (gleiche §32a-Formel) für unabhängige Soll-Werte.
function referenz2024(x: number): number {
  if (x <= 11604) return 0;
  if (x <= 17005) {
    const y = (x - 11604) / 10000;
    return (922.98 * y + 1400) * y;
  }
  if (x <= 66760) {
    const z = (x - 17005) / 10000;
    return (181.19 * z + 2397) * z + 1025.38;
  }
  if (x <= 277825) return 0.42 * x - 10602.13;
  return 0.45 * x - 18936.88;
}

// --- Tests ---------------------------------------------------------------

describe("rundeCent", () => {
  it("rundet kaufmännisch symmetrisch (halbe Cent vom Nullpunkt weg)", () => {
    // 2.345 * 100 = 234.5 (float-sicher) → 2.35; gespiegelt für negativ.
    expect(rundeCent(2.345)).toBe(2.35);
    expect(rundeCent(-2.345)).toBe(-2.35);
    expect(rundeCent(2.344)).toBe(2.34);
    expect(rundeCent(-2.344)).toBe(-2.34);
    expect(rundeCent(0)).toBe(0);
  });
});

describe("seedTarif", () => {
  it("liefert exakten Tarif für 2024/2025", () => {
    expect(seedTarif(2024).exakt).toBe(true);
    expect(seedTarif(2025).exakt).toBe(true);
    expect(seedTarif(2024).tarif.grundfreibetrag).toBe(11604);
    expect(seedTarif(2025).tarif.grundfreibetrag).toBe(12096);
  });

  it("fällt für unbekanntes Jahr auf den letzten bekannten Tarif zurück", () => {
    const r = seedTarif(2030);
    expect(r.exakt).toBe(false);
    expect(r.tarif.jahr).toBe(2025); // zuletzt bekannter <= 2030
    const r2 = seedTarif(1990);
    expect(r2.exakt).toBe(false);
    expect(r2.tarif.jahr).toBe(2024); // ältester bekannter
  });
});

describe("berechneEst — Nullzone (Grundfreibetrag)", () => {
  it("zvE unter dem Grundfreibetrag → Steuer 0", () => {
    const r = berechneEst(TARIF_2024, eingabe({ euer_gewinn: 10000 }), true);
    expect(r.einkommensteuer).toBe(0);
    expect(r.soli).toBe(0);
    expect(r.gesamtbelastung).toBe(0);
    expect(r.grenzsteuersatz).toBe(0);
    expect(r.effektiver_steuersatz).toBe(0);
  });

  it("zvE exakt am Grundfreibetrag → Steuer 0", () => {
    const r = berechneEst(TARIF_2024, eingabe({ euer_gewinn: 11604 }), true);
    expect(r.einkommensteuer).toBe(0);
  });
});

describe("berechneEst — Progressionszonen", () => {
  it("Zone 2: 15.000 € zvE entspricht der §32a-Formel", () => {
    const r = berechneEst(TARIF_2024, eingabe({ euer_gewinn: 15000 }), true);
    expect(r.einkommensteuer).toBe(rundeCent(referenz2024(15000)));
    expect(r.einkommensteuer).toBeGreaterThan(0);
  });

  it("Zone 3: 40.000 € zvE entspricht der §32a-Formel", () => {
    const r = berechneEst(TARIF_2024, eingabe({ euer_gewinn: 40000 }), true);
    expect(r.einkommensteuer).toBe(rundeCent(referenz2024(40000)));
  });

  it("Grenzsteuersatz steigt mit dem Einkommen (Progression)", () => {
    const a = berechneEst(TARIF_2024, eingabe({ euer_gewinn: 20000 }), true);
    const b = berechneEst(TARIF_2024, eingabe({ euer_gewinn: 50000 }), true);
    expect(b.grenzsteuersatz).toBeGreaterThan(a.grenzsteuersatz);
    expect(a.grenzsteuersatz).toBeGreaterThan(0);
    expect(b.grenzsteuersatz).toBeLessThan(0.42);
  });
});

describe("berechneEst — Spitzensteuersatz (lineare Zonen)", () => {
  it("Zone 4: 42 % Grenzsteuersatz, Formel 0,42·zvE − c", () => {
    const r = berechneEst(TARIF_2024, eingabe({ euer_gewinn: 120000 }), true);
    expect(r.grenzsteuersatz).toBeCloseTo(0.42, 10);
    expect(r.einkommensteuer).toBe(rundeCent(referenz2024(120000)));
  });

  it("Zone 5: 45 % Reichensteuersatz", () => {
    const r = berechneEst(TARIF_2024, eingabe({ euer_gewinn: 400000 }), true);
    expect(r.grenzsteuersatz).toBeCloseTo(0.45, 10);
    expect(r.einkommensteuer).toBe(rundeCent(referenz2024(400000)));
  });
});

describe("berechneEst — Splitting (Einzel vs. Zusammen)", () => {
  it("Zusammenveranlagung = 2× Tarif auf halbes zvE (Splittingvorteil)", () => {
    const einzel = berechneEst(
      TARIF_2024,
      eingabe({ euer_gewinn: 80000, veranlagung: "einzel" }),
      true,
    );
    const zusammen = berechneEst(
      TARIF_2024,
      eingabe({ euer_gewinn: 80000, veranlagung: "zusammen" }),
      true,
    );
    // Splitting muss günstiger (kleinere ESt) sein bei progressivem Tarif.
    expect(zusammen.einkommensteuer).toBeLessThan(einzel.einkommensteuer);
    // 2× ESt(40.000) (amtliche Halbierung auf volle Euro).
    expect(zusammen.einkommensteuer).toBe(
      rundeCent(referenz2024(40000) * 2),
    );
  });

  it("Splitting bei niedrigem zvE → beide 0 (unter doppeltem GF)", () => {
    const z = berechneEst(
      TARIF_2024,
      eingabe({ euer_gewinn: 22000, veranlagung: "zusammen" }),
      true,
    );
    expect(z.einkommensteuer).toBe(0);
  });
});

describe("berechneEst — Solidaritätszuschlag", () => {
  it("unter der Soli-Freigrenze → kein Soli", () => {
    const r = berechneEst(TARIF_2024, eingabe({ euer_gewinn: 30000 }), true);
    expect(r.einkommensteuer).toBeLessThan(TARIF_2024.soli_freigrenze);
    expect(r.soli).toBe(0);
  });

  it("deutlich über der Freigrenze → voller Soli-Satz (5,5 %)", () => {
    const r = berechneEst(TARIF_2024, eingabe({ euer_gewinn: 200000 }), true);
    expect(r.einkommensteuer).toBeGreaterThan(TARIF_2024.soli_freigrenze);
    // In der vollen Zone: Soli = 5,5 % der ESt (Milderung nicht mehr bindend).
    expect(r.soli).toBe(rundeCent(0.055 * r.einkommensteuer));
    expect(r.gesamtbelastung).toBe(
      rundeCent(r.einkommensteuer + r.soli),
    );
  });

  it("Soli-Freigrenze bei Zusammenveranlagung verdoppelt", () => {
    // ESt knapp über einfacher, aber unter doppelter Freigrenze → kein Soli.
    const r = berechneEst(
      TARIF_2024,
      eingabe({ euer_gewinn: 130000, veranlagung: "zusammen" }),
      true,
    );
    expect(r.einkommensteuer).toBeGreaterThan(TARIF_2024.soli_freigrenze);
    expect(r.einkommensteuer).toBeLessThan(
      TARIF_2024.soli_freigrenze * 2,
    );
    expect(r.soli).toBe(0);
  });
});

describe("berechneEst — Verlust & Hinweise", () => {
  it("negativer Gewinn (Verlust) → Steuer 0 + Hinweis", () => {
    const r = berechneEst(
      TARIF_2024,
      eingabe({ euer_gewinn: -25000 }),
      true,
    );
    expect(r.einkommensteuer).toBe(0);
    expect(r.soli).toBe(0);
    expect(r.bemessungsgrundlage).toBe(0);
    expect(r.hinweise.some((h) => /Verlust/i.test(h))).toBe(true);
  });

  it("Fallback-Tarif erzeugt Warn-Hinweis", () => {
    const r = berechneEst(
      TARIF_2025,
      eingabe({ jahr: 2030, euer_gewinn: 50000, jahrFallbackInfo: "2030" }),
      false,
    );
    expect(r.tarif_aus_db).toBe(false);
    expect(r.hinweise.some((h) => /2030/.test(h))).toBe(true);
  });
});

describe("berechneEst — Effektivsatz, Rundung, weitere Einkünfte", () => {
  it("Effektivsatz < Grenzsatz im progressiven Bereich", () => {
    const r = berechneEst(TARIF_2024, eingabe({ euer_gewinn: 50000 }), true);
    expect(r.effektiver_steuersatz).toBeGreaterThan(0);
    expect(r.effektiver_steuersatz).toBeLessThan(r.grenzsteuersatz);
  });

  it("weitere Einkünfte erhöhen das zvE und die Steuer", () => {
    const ohne = berechneEst(
      TARIF_2024,
      eingabe({ euer_gewinn: 30000 }),
      true,
    );
    const mit = berechneEst(
      TARIF_2024,
      eingabe({ euer_gewinn: 30000, weitere_einkuenfte: 20000 }),
      true,
    );
    expect(mit.zu_versteuerndes_einkommen).toBe(50000);
    expect(mit.einkommensteuer).toBeGreaterThan(ohne.einkommensteuer);
  });

  it("zvE wird vor Tarifanwendung auf volle Euro abgerundet", () => {
    const r = berechneEst(
      TARIF_2024,
      eingabe({ euer_gewinn: 30000.99 }),
      true,
    );
    expect(r.bemessungsgrundlage).toBe(30000);
    expect(r.einkommensteuer).toBe(rundeCent(referenz2024(30000)));
  });

  it("Ergebniswerte sind cent-genau (max. 2 Nachkommastellen)", () => {
    const r = berechneEst(
      TARIF_2024,
      eingabe({ euer_gewinn: 73214.57 }),
      true,
    );
    for (const v of [
      r.einkommensteuer,
      r.soli,
      r.gesamtbelastung,
      r.abschlusszahlung,
    ]) {
      expect(Math.round(v * 100)).toBe(v * 100);
    }
  });

  it("Abschlusszahlung = Gesamtbelastung − Vorauszahlungen (Erstattung negativ)", () => {
    const r = berechneEst(
      TARIF_2024,
      eingabe({ euer_gewinn: 40000, vorauszahlungen: 100000 }),
      true,
    );
    expect(r.abschlusszahlung).toBe(
      rundeCent(r.gesamtbelastung - 100000),
    );
    expect(r.abschlusszahlung).toBeLessThan(0); // Erstattung
  });
});
