// PROJ-32 (AC3): Tests der reinen Template-Render-Funktion.

import { describe, it, expect } from "vitest";
import { rendereErinnerungMail } from "./template";
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

describe("rendereErinnerungMail", () => {
  it("enthält Periode und Abgabefrist in Betreff, Text und HTML", () => {
    const m = rendereErinnerungMail({
      frist: frist(),
      stufe: "14_tage",
      appUrl: "https://app.example.de",
    });
    for (const teil of [m.betreff, m.text, m.html]) {
      expect(teil).toContain("März 2026");
      expect(teil).toContain("2026-04-10");
    }
  });

  it("Resttage im Text bei gelber/roter Stufe", () => {
    const m = rendereErinnerungMail({
      frist: frist({ tage_bis_frist: 10 }),
      stufe: "14_tage",
      appUrl: "https://app.example.de",
    });
    expect(m.text).toContain("noch 10 Tage");
  });

  it("Überfälligkeit klar benannt", () => {
    const m = rendereErinnerungMail({
      frist: frist({ tage_bis_frist: -3, ueberfaellig: true, ampel: "rot" }),
      stufe: "ueberfaellig",
      appUrl: "https://app.example.de",
    });
    expect(m.text).toContain("überfällig");
    expect(m.betreff).toContain("Überfällig");
  });

  it("enthält Link ins Tool aus appUrl (ohne Doppel-Slash)", () => {
    const m = rendereErinnerungMail({
      frist: frist(),
      stufe: "14_tage",
      appUrl: "https://app.example.de/",
    });
    expect(m.text).toContain("https://app.example.de/ust-voranmeldung");
    expect(m.html).toContain("https://app.example.de/ust-voranmeldung");
  });

  it("Betreff-Präfix unterscheidet die Stufen", () => {
    expect(
      rendereErinnerungMail({
        frist: frist(),
        stufe: "14_tage",
        appUrl: "https://x.de",
      }).betreff,
    ).toContain("Erinnerung");
    expect(
      rendereErinnerungMail({
        frist: frist({ tage_bis_frist: 2, ampel: "rot" }),
        stufe: "3_tage",
        appUrl: "https://x.de",
      }).betreff,
    ).toContain("Dringend");
  });
});
