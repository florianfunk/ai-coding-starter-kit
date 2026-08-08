import { describe, expect, it } from "vitest";
import { planeSyncSeite } from "./sync-plan";
import type { MappedBeleg } from "./client";

function beleg(over: Partial<MappedBeleg> = {}): MappedBeleg {
  return {
    paperless_id: 1,
    titel: "Rechnung",
    beleg_datum: "2026-08-01",
    korrespondent: "Lieferant",
    betrag: 119,
    tags: [],
    dokumenttyp: "Rechnung",
    ocr_text: "Gesamt 119,00",
    quell_link: "https://paperless.example/documents/1/",
    inhalt_hash: "hash-neu",
    status: "importiert",
    ...over,
  };
}

describe("planeSyncSeite", () => {
  it("schreibt nur neue und geänderte Belege und zählt unveränderte separat", () => {
    const vorhanden = new Map<number, string | null>([
      [1, "hash-neu"],
      [2, "hash-alt"],
    ]);
    const plan = planeSyncSeite(
      [beleg(), beleg({ paperless_id: 2 }), beleg({ paperless_id: 3 })],
      vorhanden,
    );

    expect(plan.unveraendert).toBe(1);
    expect(plan.aktualisiert).toBe(1);
    expect(plan.neu).toBe(1);
    expect(plan.zu_schreiben.map((b) => b.paperless_id)).toEqual([2, 3]);
  });
});
