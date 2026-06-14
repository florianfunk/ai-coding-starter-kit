import { describe, expect, it } from "vitest";
import {
  bereinigeMusterRand,
  gemeinsameTeilzeichenkette,
  schlageRegelVor,
} from "./regel-vorschlag";

describe("gemeinsameTeilzeichenkette", () => {
  it("liefert leeren String für leere Liste", () => {
    expect(gemeinsameTeilzeichenkette([])).toBe("");
  });

  it("gibt den einzigen Wert unverändert zurück", () => {
    expect(gemeinsameTeilzeichenkette(["Apple Services"])).toBe(
      "Apple Services",
    );
  });

  it("gibt bei identischen Werten den ganzen String zurück", () => {
    expect(
      gemeinsameTeilzeichenkette(["Apple Services", "Apple Services"]),
    ).toBe("Apple Services");
  });

  it("findet den gemeinsamen Kern und ignoriert variable IDs", () => {
    const kern = gemeinsameTeilzeichenkette([
      "PayPal *Fitmartgmbh 041218303100",
      "PayPal *Fitmartgmbh 099887766",
    ]);
    expect(kern.toLowerCase()).toContain("fitmartgmbh");
    expect(kern).not.toContain("041218303100");
  });

  it("ist case-insensitiv beim Vergleich, behält aber die Schreibweise der Basis", () => {
    const kern = gemeinsameTeilzeichenkette(["TELEKOM Festnetz", "Telekom Mobil"]);
    expect(kern.toLowerCase()).toContain("telekom");
  });
});

describe("bereinigeMusterRand", () => {
  it("entfernt führenden PayPal-Präfix und nachlaufende ID", () => {
    expect(bereinigeMusterRand("PayPal *Fitmartgmbh 041218303100")).toBe(
      "Fitmartgmbh",
    );
  });

  it("entfernt STRIPE*-Präfix", () => {
    expect(bereinigeMusterRand("STRIPE*ACME")).toBe("ACME");
  });

  it("lässt einen Provider ohne * unangetastet (Provider ist selbst Empfänger)", () => {
    expect(bereinigeMusterRand("PayPal Europe")).toBe("PayPal Europe");
  });

  it("zerschneidet kein Wort, das zufällig mit einem Präfix beginnt", () => {
    expect(bereinigeMusterRand("Sparen Sofort")).toBe("Sparen Sofort");
  });

  it("behält kurze Ziffernfolgen (≤ 2 Ziffern) im Namen", () => {
    expect(bereinigeMusterRand("S3 Studio")).toBe("S3 Studio");
  });

  it("behält einen reinen Namen ohne Ränder unverändert", () => {
    expect(bereinigeMusterRand("Digital Charging Solutions GmbH")).toBe(
      "Digital Charging Solutions GmbH",
    );
  });
});

describe("schlageRegelVor", () => {
  it("schlägt Empfänger-Muster und Bezeichnung für identische Empfänger vor", () => {
    const v = schlageRegelVor([
      { empfaenger: "Apple Services", verwendungszweck: "iCloud+" },
      { empfaenger: "Apple Services", verwendungszweck: "Apple One" },
    ]);
    expect(v.empfaenger_muster).toBe("Apple Services");
    expect(v.zweck_muster).toBe("");
    expect(v.bezeichnung).toBe("Apple Services automatisch");
  });

  it("leitet ein stabiles Muster aus PayPal-Durchläufen mit variabler ID ab", () => {
    const v = schlageRegelVor([
      { empfaenger: "PayPal *Fitmartgmbh 041218303100", verwendungszweck: null },
      { empfaenger: "PayPal *Fitmartgmbh 099887766", verwendungszweck: null },
    ]);
    expect(v.empfaenger_muster.toLowerCase()).toContain("fitmartgmbh");
    expect(v.empfaenger_muster).not.toContain("041218303100");
  });

  it("fällt auf den Zweck zurück, wenn kein Empfänger vorhanden ist", () => {
    const v = schlageRegelVor([
      { empfaenger: null, verwendungszweck: "Monatsbeitrag Fitnessstudio" },
      { empfaenger: "", verwendungszweck: "Monatsbeitrag Sauna" },
    ]);
    expect(v.empfaenger_muster).toBe("");
    expect(v.zweck_muster.toLowerCase()).toContain("monatsbeitrag");
  });

  it("liefert den neutralen Standard, wenn nichts Brauchbares vorhanden ist", () => {
    const v = schlageRegelVor([{ empfaenger: null, verwendungszweck: null }]);
    expect(v.empfaenger_muster).toBe("");
    expect(v.zweck_muster).toBe("");
    expect(v.bezeichnung).toBe("Neue Regel");
  });

  it("erzeugt für einen Einzelfall ein Muster aus dem Empfänger", () => {
    const v = schlageRegelVor([
      { empfaenger: "Digital Charging Solutions GmbH", verwendungszweck: null },
    ]);
    expect(v.empfaenger_muster).toBe("Digital Charging Solutions GmbH");
    expect(v.bezeichnung).toBe("Digital Charging Solutions GmbH automatisch");
  });
});
