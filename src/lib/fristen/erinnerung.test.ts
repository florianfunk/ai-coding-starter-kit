// PROJ-32 (AC1): Tests der reinen Auswahl-Logik.

import { describe, it, expect } from "vitest";
import {
  bestimmeFaelligeErinnerung,
  idempotenzSchluessel,
  periodeKey,
} from "./erinnerung";
import type { UstFristInfo } from "@/lib/dashboard/fristen";

function frist(overrides: Partial<UstFristInfo> = {}): UstFristInfo {
  return {
    periode: {
      jahr: 2026,
      periode: 3,
      label: "März 2026",
      start: "2026-03-01",
      ende: "2026-03-31",
    },
    abgabefrist: "2026-04-10",
    tage_bis_frist: 10,
    ueberfaellig: false,
    ampel: "gelb",
    ...overrides,
  };
}

describe("periodeKey", () => {
  it("baut jahr-periode", () => {
    expect(periodeKey(frist())).toBe("2026-3");
  });
});

describe("bestimmeFaelligeErinnerung", () => {
  it("liefert null, wenn keine Frist vorliegt", () => {
    expect(bestimmeFaelligeErinnerung(null, new Set())).toBeNull();
  });

  it("neutral (>14 Tage) → keine Mail", () => {
    const f = frist({ tage_bis_frist: 20, ampel: "neutral" });
    expect(bestimmeFaelligeErinnerung(f, new Set())).toBeNull();
  });

  it("gelbe Ampel (4..14 Tage) → Stufe 14_tage", () => {
    const f = frist({ tage_bis_frist: 10, ampel: "gelb" });
    expect(bestimmeFaelligeErinnerung(f, new Set())).toEqual({
      stufe: "14_tage",
      periode_key: "2026-3",
    });
  });

  it("rote Ampel (<=3 Tage) → Stufe 3_tage", () => {
    const f = frist({ tage_bis_frist: 2, ampel: "rot" });
    expect(bestimmeFaelligeErinnerung(f, new Set())).toEqual({
      stufe: "3_tage",
      periode_key: "2026-3",
    });
  });

  it("überfällig → Stufe ueberfaellig (auch bei roter Ampel)", () => {
    const f = frist({ tage_bis_frist: -5, ueberfaellig: true, ampel: "rot" });
    expect(bestimmeFaelligeErinnerung(f, new Set())).toEqual({
      stufe: "ueberfaellig",
      periode_key: "2026-3",
    });
  });

  it("idempotent: bereits gesendete Stufe → null", () => {
    const f = frist({ tage_bis_frist: 10, ampel: "gelb" });
    const gesendet = new Set([idempotenzSchluessel("2026-3", "14_tage")]);
    expect(bestimmeFaelligeErinnerung(f, gesendet)).toBeNull();
  });

  it("eine andere bereits gesendete Stufe blockiert die aktuelle nicht", () => {
    // 14_tage wurde versendet, jetzt rote Ampel → 3_tage ist neu fällig.
    const f = frist({ tage_bis_frist: 2, ampel: "rot" });
    const gesendet = new Set([idempotenzSchluessel("2026-3", "14_tage")]);
    expect(bestimmeFaelligeErinnerung(f, gesendet)).toEqual({
      stufe: "3_tage",
      periode_key: "2026-3",
    });
  });

  it("jede Stufe genau einmal über den Lebenszyklus", () => {
    const gesendet = new Set<string>();

    // 1. gelb → 14_tage
    let e = bestimmeFaelligeErinnerung(
      frist({ tage_bis_frist: 12, ampel: "gelb" }),
      gesendet,
    );
    expect(e?.stufe).toBe("14_tage");
    gesendet.add(idempotenzSchluessel(e!.periode_key, e!.stufe));

    // erneut gelb → nichts mehr
    expect(
      bestimmeFaelligeErinnerung(
        frist({ tage_bis_frist: 8, ampel: "gelb" }),
        gesendet,
      ),
    ).toBeNull();

    // 2. rot → 3_tage
    e = bestimmeFaelligeErinnerung(
      frist({ tage_bis_frist: 2, ampel: "rot" }),
      gesendet,
    );
    expect(e?.stufe).toBe("3_tage");
    gesendet.add(idempotenzSchluessel(e!.periode_key, e!.stufe));
    expect(
      bestimmeFaelligeErinnerung(
        frist({ tage_bis_frist: 1, ampel: "rot" }),
        gesendet,
      ),
    ).toBeNull();

    // 3. überfällig → ueberfaellig
    e = bestimmeFaelligeErinnerung(
      frist({ tage_bis_frist: -1, ueberfaellig: true, ampel: "rot" }),
      gesendet,
    );
    expect(e?.stufe).toBe("ueberfaellig");
    gesendet.add(idempotenzSchluessel(e!.periode_key, e!.stufe));
    expect(
      bestimmeFaelligeErinnerung(
        frist({ tage_bis_frist: -3, ueberfaellig: true, ampel: "rot" }),
        gesendet,
      ),
    ).toBeNull();
  });
});
