import { describe, it, expect } from "vitest";
import { kompiliereWennSicher, istSicheresMuster } from "./regex-engine";

describe("kompiliereWennSicher — gültige Muster", () => {
  it("kompiliert ein einfaches Präfix-Muster case-insensitive", () => {
    const re = kompiliereWennSicher("^stripe\\*.*");
    expect(re).not.toBeNull();
    expect(re!.flags).toContain("i");
    expect(re!.test("STRIPE*ACME LTD")).toBe(true);
    expect(re!.test("paddle acme")).toBe(false);
  });

  it("matcht case-insensitive", () => {
    const re = kompiliereWennSicher("telekom");
    expect(re!.test("Deutsche Telekom AG")).toBe(true);
    expect(re!.test("TELEKOM")).toBe(true);
  });

  it("akzeptiert einfache Alternation", () => {
    const re = kompiliereWennSicher("(amazon|aws)");
    expect(re).not.toBeNull();
    expect(re!.test("amazon web services")).toBe(true);
    expect(re!.test("aws emea")).toBe(true);
  });

  it("akzeptiert eine begrenzte Quantifizierung", () => {
    const re = kompiliereWennSicher("a{1,5}b");
    expect(re).not.toBeNull();
    expect(re!.test("aaab")).toBe(true);
  });

  it("akzeptiert Zeichenklassen mit Quantor", () => {
    const re = kompiliereWennSicher("[a-z]+\\d{2}");
    expect(re).not.toBeNull();
    expect(re!.test("abc42")).toBe(true);
  });
});

describe("kompiliereWennSicher — REJECT (ReDoS / ungültig / zu lang)", () => {
  it("lehnt verschachtelte Plus-Quantoren ab: (a+)+", () => {
    expect(kompiliereWennSicher("(a+)+")).toBeNull();
  });

  it("lehnt (a*)* ab", () => {
    expect(kompiliereWennSicher("(a*)*")).toBeNull();
  });

  it("lehnt (.*)* ab", () => {
    expect(kompiliereWennSicher("(.*)*")).toBeNull();
  });

  it("lehnt (.+)+ ab", () => {
    expect(kompiliereWennSicher("(.+)+")).toBeNull();
  });

  it("lehnt (a+)* ab (gemischte verschachtelte Quantoren)", () => {
    expect(kompiliereWennSicher("(a+)*")).toBeNull();
  });

  it("lehnt eine Gruppe mit {n,}-Quantor um einen inneren Quantor ab", () => {
    expect(kompiliereWennSicher("(a+){2,}")).toBeNull();
  });

  it("lehnt Alternation hinter Quantor ab: (a|aa)+", () => {
    expect(kompiliereWennSicher("(a|aa)+")).toBeNull();
  });

  it("lehnt Backreference mit Quantor ab", () => {
    expect(kompiliereWennSicher("(a)\\1+")).toBeNull();
  });

  it("lehnt ein Muster > 200 Zeichen ab", () => {
    const lang = "a".repeat(201);
    expect(kompiliereWennSicher(lang)).toBeNull();
  });

  it("akzeptiert genau 200 Zeichen", () => {
    const grenze = "a".repeat(200);
    expect(kompiliereWennSicher(grenze)).not.toBeNull();
  });

  it("lehnt ungültige Regex-Syntax ab", () => {
    expect(kompiliereWennSicher("(unbalanced")).toBeNull();
    expect(kompiliereWennSicher("[z-a]")).toBeNull();
    expect(kompiliereWennSicher("*invalid")).toBeNull();
  });

  it("lehnt leeren/whitespace-Muster ab", () => {
    expect(kompiliereWennSicher("")).toBeNull();
    expect(kompiliereWennSicher("   ")).toBeNull();
  });

  it("lehnt null/undefined ab", () => {
    expect(kompiliereWennSicher(null as unknown as string)).toBeNull();
    expect(kompiliereWennSicher(undefined as unknown as string)).toBeNull();
  });
});

describe("istSicheresMuster — statischer Linter", () => {
  it("erlaubt harmlose Muster", () => {
    expect(istSicheresMuster("^stripe\\*")).toBe(true);
    expect(istSicheresMuster("(amazon|aws)")).toBe(true);
    expect(istSicheresMuster("a{1,5}")).toBe(true);
  });

  it("verbietet verschachtelte Quantoren", () => {
    expect(istSicheresMuster("(a+)+")).toBe(false);
    expect(istSicheresMuster("(.*)*")).toBe(false);
    expect(istSicheresMuster("(a*)+")).toBe(false);
  });

  it("verbietet Alternation hinter Quantor", () => {
    expect(istSicheresMuster("(a|b|c)+")).toBe(false);
  });

  it("verbietet Backreference mit Quantor", () => {
    expect(istSicheresMuster("(x)\\1*")).toBe(false);
  });
});
