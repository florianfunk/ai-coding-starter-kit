import { describe, expect, it } from "vitest";
import {
  formatKundenNr,
  isValidKundenNr,
  nextKundenNr,
} from "./kunden-nr-generator";

describe("formatKundenNr", () => {
  it("padded auf 4 Stellen", () => {
    expect(formatKundenNr(1)).toBe("K-0001");
    expect(formatKundenNr(42)).toBe("K-0042");
    expect(formatKundenNr(9999)).toBe("K-9999");
  });

  it("erlaubt mehr als 4 Stellen ab 10000", () => {
    expect(formatKundenNr(10000)).toBe("K-10000");
  });
});

describe("isValidKundenNr", () => {
  it.each(["K-0001", "K-0042", "K-9999", "K-10000"])("akzeptiert %s", (nr) => {
    expect(isValidKundenNr(nr)).toBe(true);
  });

  it.each(["", "K-1", "K-001", "k-0042", "0042", "K0042", "K-abc"])(
    "lehnt %s ab",
    (nr) => {
      expect(isValidKundenNr(nr)).toBe(false);
    },
  );
});

describe("nextKundenNr", () => {
  it("liefert K-0001 bei leerer Liste", () => {
    expect(nextKundenNr([])).toBe("K-0001");
  });

  it("liefert max+1 fortlaufend", () => {
    expect(nextKundenNr(["K-0001", "K-0002", "K-0003"])).toBe("K-0004");
  });

  it("fuellt Luecken NICHT (K-0023 geloescht -> max+1 weiter)", () => {
    expect(nextKundenNr(["K-0001", "K-0002", "K-0050"])).toBe("K-0051");
  });

  it("ignoriert ungueltige Eintraege", () => {
    expect(nextKundenNr(["K-0010", "muell", "k-0099"])).toBe("K-0011");
  });

  it("funktioniert ueber 10000 hinaus", () => {
    expect(nextKundenNr(["K-9999"])).toBe("K-10000");
  });
});
