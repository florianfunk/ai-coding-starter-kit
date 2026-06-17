import { describe, expect, it } from "vitest";
import {
  baueVorjahrUebernahmeMap,
  vorjahrSchluessel,
  type FinalBuchungZeile,
} from "./vorjahres-uebernahme";

function zeile(over: Partial<FinalBuchungZeile>): FinalBuchungZeile {
  return {
    empfaenger_normalisiert: "rewe",
    kategorie_id: "kat-lebensmittel",
    klassifikation: "privat",
    steuerrelevant: false,
    ust_satz: null,
    status: "auto_verbucht",
    ...over,
  };
}

describe("vorjahrSchluessel", () => {
  it("trimmt und lowercased", () => {
    expect(vorjahrSchluessel("  REWE Markt ")).toBe("rewe markt");
    expect(vorjahrSchluessel(null)).toBe("");
    expect(vorjahrSchluessel(undefined)).toBe("");
  });
});

describe("baueVorjahrUebernahmeMap", () => {
  it("übernimmt einen Empfänger mit ≥2 gleichen auto-verbuchten Buchungen", () => {
    const map = baueVorjahrUebernahmeMap([
      zeile({}),
      zeile({}),
    ]);
    expect(map.get("rewe")).toEqual({
      kategorie_id: "kat-lebensmittel",
      klassifikation: "privat",
      steuerrelevant: false,
      ust_satz: null,
    });
  });

  it("übernimmt einen Empfänger mit genau 1 manuell bestätigten Buchung", () => {
    const map = baueVorjahrUebernahmeMap([
      zeile({ status: "manuell_bestaetigt" }),
    ]);
    expect(map.has("rewe")).toBe(true);
  });

  it("übernimmt NICHT bei genau 1 auto-verbuchten Buchung (Outlier-Schutz)", () => {
    const map = baueVorjahrUebernahmeMap([zeile({ status: "auto_verbucht" })]);
    expect(map.has("rewe")).toBe(false);
  });

  it("übernimmt NICHT bei gemischten Kategorien", () => {
    const map = baueVorjahrUebernahmeMap([
      zeile({ kategorie_id: "kat-a" }),
      zeile({ kategorie_id: "kat-b" }),
    ]);
    expect(map.has("rewe")).toBe(false);
  });

  it("übernimmt NICHT bei gleicher Kategorie aber gemischter Klassifikation", () => {
    const map = baueVorjahrUebernahmeMap([
      zeile({ klassifikation: "privat" }),
      zeile({ klassifikation: "geschaeftlich" }),
    ]);
    expect(map.has("rewe")).toBe(false);
  });

  it("ignoriert Buchungen ohne Kategorie bei der Eindeutigkeit", () => {
    // 1 ohne Kategorie + 2 mit gleicher Kategorie → eindeutig (2 zählen).
    const map = baueVorjahrUebernahmeMap([
      zeile({ kategorie_id: null }),
      zeile({ kategorie_id: "kat-x", klassifikation: "geschaeftlich", steuerrelevant: true, ust_satz: 19 }),
      zeile({ kategorie_id: "kat-x", klassifikation: "geschaeftlich", steuerrelevant: true, ust_satz: 19 }),
    ]);
    expect(map.get("rewe")).toEqual({
      kategorie_id: "kat-x",
      klassifikation: "geschaeftlich",
      steuerrelevant: true,
      ust_satz: 19,
    });
  });

  it("gruppiert verschiedene Empfänger getrennt + normalisiert den Schlüssel", () => {
    const map = baueVorjahrUebernahmeMap([
      zeile({ empfaenger_normalisiert: "Adobe", status: "manuell_bestaetigt", kategorie_id: "kat-software", klassifikation: "geschaeftlich" }),
      zeile({ empfaenger_normalisiert: "ALDI", kategorie_id: "kat-lebensmittel" }),
      zeile({ empfaenger_normalisiert: "ALDI", kategorie_id: "kat-lebensmittel" }),
    ]);
    expect(map.has("adobe")).toBe(true);
    expect(map.has("aldi")).toBe(true);
    expect(map.size).toBe(2);
  });

  it("ignoriert leere Empfänger-Schlüssel", () => {
    const map = baueVorjahrUebernahmeMap([
      zeile({ empfaenger_normalisiert: "", status: "manuell_bestaetigt" }),
      zeile({ empfaenger_normalisiert: null, status: "manuell_bestaetigt" }),
    ]);
    expect(map.size).toBe(0);
  });

  // --- Manuell-First (PROJ-24) ---

  it("Manuell-First: manuelle Kategorie schlägt abweichende auto-verbuchte", () => {
    const map = baueVorjahrUebernahmeMap([
      zeile({ status: "manuell_bestaetigt", kategorie_id: "kat-richtig", klassifikation: "geschaeftlich" }),
      zeile({ status: "auto_verbucht", kategorie_id: "kat-llm-falsch", klassifikation: "privat" }),
      zeile({ status: "auto_verbucht", kategorie_id: "kat-llm-falsch", klassifikation: "privat" }),
    ]);
    // Basis = nur die manuelle → kat-richtig, trotz 2x abweichender auto.
    expect(map.get("rewe")?.kategorie_id).toBe("kat-richtig");
    expect(map.get("rewe")?.klassifikation).toBe("geschaeftlich");
  });

  it("widersprüchliche MANUELLE Kategorien → keine Übernahme", () => {
    const map = baueVorjahrUebernahmeMap([
      zeile({ status: "manuell_bestaetigt", kategorie_id: "kat-a" }),
      zeile({ status: "manuell_bestaetigt", kategorie_id: "kat-b" }),
    ]);
    expect(map.has("rewe")).toBe(false);
  });

  it("eine manuelle reicht, auch wenn nur eine einzige existiert", () => {
    const map = baueVorjahrUebernahmeMap([
      zeile({ status: "manuell_bestaetigt", kategorie_id: "kat-x" }),
    ]);
    expect(map.get("rewe")?.kategorie_id).toBe("kat-x");
  });
});
