// PROJ-18 — Unit-Tests für die reine Lieferanten-Aggregation. Wie bei
// wiederkehrend-erkennung.test.ts: kein Supabase, deterministisch.

import { describe, it, expect } from "vitest";
import {
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
