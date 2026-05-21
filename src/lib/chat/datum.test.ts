import { describe, expect, it } from "vitest";
import { relativesDatum } from "./datum";

describe("relativesDatum", () => {
  const jetzt = new Date("2026-05-21T12:00:00.000Z");

  it("formatiert Minuten relativ", () => {
    const vor5Min = new Date(jetzt.getTime() - 5 * 60 * 1000).toISOString();
    expect(relativesDatum(vor5Min, jetzt)).toBe("vor 5 Min.");
  });

  it("formatiert Stunden relativ", () => {
    const vor2Std = new Date(jetzt.getTime() - 2 * 60 * 60 * 1000).toISOString();
    expect(relativesDatum(vor2Std, jetzt)).toBe("vor 2 Std.");
  });

  it("zeigt 'gestern' bei 1 Tag", () => {
    const gestern = new Date(jetzt.getTime() - 26 * 60 * 60 * 1000).toISOString();
    expect(relativesDatum(gestern, jetzt)).toBe("gestern");
  });

  it("zeigt 'vor N Tagen' bei 2-6 Tagen", () => {
    const vor3Tagen = new Date(jetzt.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(relativesDatum(vor3Tagen, jetzt)).toBe("vor 3 Tagen");
  });

  it("zeigt Tag.Monat bei selbem Jahr", () => {
    const vor30Tagen = new Date(jetzt.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(relativesDatum(vor30Tagen, jetzt)).toBe("21.04.");
  });

  it("zeigt volles Datum bei anderem Jahr", () => {
    const lange = new Date("2024-12-15T10:00:00.000Z").toISOString();
    expect(relativesDatum(lange, jetzt)).toBe("15.12.2024");
  });

  it("zeigt 'gerade eben' bei < 1 Min", () => {
    const eben = new Date(jetzt.getTime() - 30 * 1000).toISOString();
    expect(relativesDatum(eben, jetzt)).toBe("gerade eben");
  });
});
