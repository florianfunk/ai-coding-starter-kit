import { describe, it, expect } from "vitest";
import {
  regelTrifftZu,
  werteRegelnAus,
  type BuchungFuerRegel,
} from "./rules";
import type { Lernregel } from "@/lib/types";

function regel(p: Partial<Lernregel>): Lernregel {
  return {
    id: p.id ?? "r1",
    bezeichnung: p.bezeichnung ?? "Regel",
    bedingung: p.bedingung ?? {},
    aktion: p.aktion ?? {},
    prioritaet: p.prioritaet ?? 100,
    aktiv: p.aktiv ?? true,
    treffer_zaehler: p.treffer_zaehler ?? 0,
  };
}

const buchung: BuchungFuerRegel = {
  konto_id: "k1",
  betrag: -49.99,
  verwendungszweck: "AWS EMEA SARL Cloud Rechnung",
  empfaenger: "Amazon Web Services",
};

describe("regelTrifftZu", () => {
  it("matcht empfaenger_muster case-insensitive als Substring", () => {
    const r = regel({ bedingung: { empfaenger_muster: "amazon web" } });
    expect(regelTrifftZu(r, buchung)).toBe(true);
  });

  it("matcht zweck_muster case-insensitive als Substring", () => {
    const r = regel({ bedingung: { zweck_muster: "cloud rechnung" } });
    expect(regelTrifftZu(r, buchung)).toBe(true);
  });

  it("matcht NICHT, wenn ein Teilkriterium fehlschlägt (UND-Logik)", () => {
    const r = regel({
      bedingung: { empfaenger_muster: "amazon", zweck_muster: "miete" },
    });
    expect(regelTrifftZu(r, buchung)).toBe(false);
  });

  it("behandelt Sonderzeichen literal (kein Regex-Eval)", () => {
    const r = regel({ bedingung: { zweck_muster: "SARL (.*)" } });
    expect(regelTrifftZu(r, buchung)).toBe(false);
  });

  it("prüft konto_id exakt", () => {
    expect(
      regelTrifftZu(regel({ bedingung: { konto_id: "k1" } }), buchung),
    ).toBe(true);
    expect(
      regelTrifftZu(regel({ bedingung: { konto_id: "k2" } }), buchung),
    ).toBe(false);
  });

  it("prüft Betragsbereich (min/max) inklusiv", () => {
    expect(
      regelTrifftZu(
        regel({ bedingung: { betrag_min: -100, betrag_max: -10 } }),
        buchung,
      ),
    ).toBe(true);
    expect(
      regelTrifftZu(regel({ bedingung: { betrag_min: 0 } }), buchung),
    ).toBe(false);
    expect(
      regelTrifftZu(regel({ bedingung: { betrag_max: -100 } }), buchung),
    ).toBe(false);
  });

  it("eine Regel ganz ohne Bedingung trifft NICHT zu (kein Catch-All)", () => {
    expect(regelTrifftZu(regel({ bedingung: {} }), buchung)).toBe(false);
  });

  it("toleriert null-Felder der Buchung", () => {
    const leer: BuchungFuerRegel = {
      konto_id: "k1",
      betrag: 0,
      verwendungszweck: null,
      empfaenger: null,
    };
    expect(
      regelTrifftZu(regel({ bedingung: { empfaenger_muster: "x" } }), leer),
    ).toBe(false);
  });
});

describe("regelTrifftZu — PROJ-15 Regex-Bedingungen", () => {
  it("matcht empfaenger_regex gegen empfaenger_normalisiert (Vorrang vor roh)", () => {
    const b: BuchungFuerRegel = {
      konto_id: "k1",
      betrag: -10,
      verwendungszweck: "abo",
      empfaenger: "STRIPE*ACME LTD",
      empfaenger_normalisiert: "acme",
    };
    expect(
      regelTrifftZu(regel({ bedingung: { empfaenger_regex: "^acme$" } }), b),
    ).toBe(true);
  });

  it("matcht empfaenger_regex case-insensitive", () => {
    const r = regel({ bedingung: { empfaenger_regex: "^stripe\\*.*" } });
    expect(regelTrifftZu(r, buchung)).toBe(false); // empfaenger=Amazon Web Services
    const b: BuchungFuerRegel = {
      konto_id: "k1",
      betrag: -10,
      verwendungszweck: "x",
      empfaenger: "STRIPE*FOO",
    };
    expect(regelTrifftZu(r, b)).toBe(true);
  });

  it("fällt auf rohes empfaenger zurück, wenn normalisiert fehlt", () => {
    const b: BuchungFuerRegel = {
      konto_id: "k1",
      betrag: -10,
      verwendungszweck: "x",
      empfaenger: "Deutsche Telekom AG",
    };
    expect(
      regelTrifftZu(regel({ bedingung: { empfaenger_regex: "telekom" } }), b),
    ).toBe(true);
  });

  it("matcht zweck_regex gegen verwendungszweck", () => {
    const r = regel({ bedingung: { zweck_regex: "cloud\\s+rechnung" } });
    expect(regelTrifftZu(r, buchung)).toBe(true);
  });

  it("UND-Verknüpfung: regex + muster müssen beide greifen", () => {
    const r = regel({
      bedingung: { empfaenger_muster: "amazon", zweck_regex: "miete" },
    });
    expect(regelTrifftZu(r, buchung)).toBe(false);
  });

  it("ein UNSICHERES Regex (ReDoS) matcht NICHT (fail-safe)", () => {
    const r = regel({ bedingung: { empfaenger_regex: "(a+)+" } });
    const b: BuchungFuerRegel = {
      konto_id: "k1",
      betrag: -10,
      verwendungszweck: "x",
      empfaenger: "aaaaaa",
    };
    expect(regelTrifftZu(r, b)).toBe(false);
  });

  it("ein ungültiges Regex matcht NICHT (fail-safe)", () => {
    const r = regel({ bedingung: { empfaenger_regex: "(unbalanced" } });
    const b: BuchungFuerRegel = {
      konto_id: "k1",
      betrag: -10,
      verwendungszweck: "x",
      empfaenger: "unbalanced",
    };
    expect(regelTrifftZu(r, b)).toBe(false);
  });

  it("leeres/whitespace-Regex zählt NICHT als Bedingung", () => {
    expect(
      regelTrifftZu(regel({ bedingung: { empfaenger_regex: "   " } }), buchung),
    ).toBe(false);
  });
});

describe("werteRegelnAus", () => {
  it("liefert null, wenn keine Regel greift", () => {
    const a = werteRegelnAus(
      [regel({ bedingung: { empfaenger_muster: "kein treffer" } })],
      buchung,
    );
    expect(a.treffer).toBeNull();
    expect(a.konflikt).toBe(false);
  });

  it("ignoriert inaktive Regeln", () => {
    const a = werteRegelnAus(
      [
        regel({
          id: "x",
          aktiv: false,
          bedingung: { empfaenger_muster: "amazon" },
          aktion: { klassifikation: "geschaeftlich" },
        }),
      ],
      buchung,
    );
    expect(a.treffer).toBeNull();
  });

  it("höchste Priorität gewinnt", () => {
    const a = werteRegelnAus(
      [
        regel({
          id: "low",
          prioritaet: 10,
          bedingung: { empfaenger_muster: "amazon" },
          aktion: { kategorie_id: "kat-low" },
        }),
        regel({
          id: "high",
          prioritaet: 900,
          bedingung: { empfaenger_muster: "amazon" },
          aktion: { kategorie_id: "kat-high" },
        }),
      ],
      buchung,
    );
    expect(a.treffer?.regel_id).toBe("high");
    expect(a.treffer?.kategorie_id).toBe("kat-high");
    expect(a.konflikt).toBe(false);
  });

  it("setzt konflikt, wenn Regeln gleicher Priorität widersprechen", () => {
    const a = werteRegelnAus(
      [
        regel({
          id: "a",
          prioritaet: 100,
          bedingung: { empfaenger_muster: "amazon" },
          aktion: { klassifikation: "geschaeftlich" },
        }),
        regel({
          id: "b",
          prioritaet: 100,
          bedingung: { zweck_muster: "cloud" },
          aktion: { klassifikation: "privat" },
        }),
      ],
      buchung,
    );
    expect(a.konflikt).toBe(true);
    expect(a.passende_regel_ids.sort()).toEqual(["a", "b"]);
  });

  it("kein Konflikt bei gleicher Priorität mit übereinstimmender Aktion", () => {
    const a = werteRegelnAus(
      [
        regel({
          id: "a",
          prioritaet: 100,
          bedingung: { empfaenger_muster: "amazon" },
          aktion: { klassifikation: "geschaeftlich" },
        }),
        regel({
          id: "b",
          prioritaet: 100,
          bedingung: { zweck_muster: "cloud" },
          aktion: { klassifikation: "geschaeftlich" },
        }),
      ],
      buchung,
    );
    expect(a.konflikt).toBe(false);
    expect(a.treffer).not.toBeNull();
  });

  it("ist deterministisch bei Prioritätsgleichstand (Sortierung nach id)", () => {
    const a = werteRegelnAus(
      [
        regel({
          id: "z",
          prioritaet: 50,
          bedingung: { empfaenger_muster: "amazon" },
          aktion: { kategorie_id: "k-z" },
        }),
        regel({
          id: "a",
          prioritaet: 50,
          bedingung: { empfaenger_muster: "amazon" },
          aktion: { kategorie_id: "k-z" },
        }),
      ],
      buchung,
    );
    expect(a.treffer?.regel_id).toBe("a");
  });
});
