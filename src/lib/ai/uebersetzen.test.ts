import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseResult,
  UebersetzenError,
} from "./uebersetzen";

describe("buildSystemPrompt", () => {
  it("nennt die Zielsprache italienisch", () => {
    const p = buildSystemPrompt("it");
    expect(p).toContain("Italienisch");
  });

  it("verlangt JSON-Output und keinen Fließtext", () => {
    const p = buildSystemPrompt("it");
    expect(p).toContain("JSON");
    expect(p).toContain("uebersetzungen");
  });

  it("schützt technische Begriffe (CRI, IP, K, Lumen, LED)", () => {
    const p = buildSystemPrompt("it");
    expect(p).toContain("CRI");
    expect(p).toContain("IP");
    expect(p).toContain("LED");
    expect(p).toContain("Lumen");
  });

  it("verlangt HTML-Tag-Erhalt", () => {
    const p = buildSystemPrompt("it");
    expect(p).toContain("HTML-Tags");
    expect(p).toContain("<p>");
  });
});

describe("buildUserPrompt", () => {
  it("listet alle Felder mit ###-Marker", () => {
    const p = buildUserPrompt({
      zielsprache: "it",
      quelltexte: {
        name: "LED-Stripe 24V",
        info_kurz: "Mit warmem Licht",
      },
    });
    expect(p).toContain("### name");
    expect(p).toContain("LED-Stripe 24V");
    expect(p).toContain("### info_kurz");
    expect(p).toContain("Mit warmem Licht");
  });
});

describe("parseResult", () => {
  it("akzeptiert gewrappte Antwort { uebersetzungen: {...} }", () => {
    const raw = JSON.stringify({
      uebersetzungen: { name: "Striscia LED 24V", info_kurz: "Con luce calda" },
    });
    const r = parseResult(raw, ["name", "info_kurz"]);
    expect(r.uebersetzungen.name).toBe("Striscia LED 24V");
    expect(r.uebersetzungen.info_kurz).toBe("Con luce calda");
  });

  it("akzeptiert auch unwrapped Antwort {...}", () => {
    const raw = JSON.stringify({ name: "Striscia LED 24V" });
    const r = parseResult(raw, ["name"]);
    expect(r.uebersetzungen.name).toBe("Striscia LED 24V");
  });

  it("filtert auf expectedKeys (Halluzinationen werden ignoriert)", () => {
    const raw = JSON.stringify({
      uebersetzungen: {
        name: "Striscia",
        unbekanntes_feld: "Sollte ignoriert werden",
      },
    });
    const r = parseResult(raw, ["name"]);
    expect(r.uebersetzungen).toEqual({ name: "Striscia" });
    expect("unbekanntes_feld" in r.uebersetzungen).toBe(false);
  });

  it("liefert leeren String für fehlende erwartete Schlüssel", () => {
    const raw = JSON.stringify({ uebersetzungen: { name: "Striscia" } });
    const r = parseResult(raw, ["name", "info_kurz"]);
    expect(r.uebersetzungen.name).toBe("Striscia");
    expect(r.uebersetzungen.info_kurz).toBe("");
  });

  it("entfernt Code-Fences ```json ... ```", () => {
    const raw = '```json\n{"uebersetzungen":{"name":"Striscia"}}\n```';
    const r = parseResult(raw, ["name"]);
    expect(r.uebersetzungen.name).toBe("Striscia");
  });

  it("fischt JSON-Objekt aus eingebettetem Text als Fallback", () => {
    const raw = "Hier ist die Antwort: {\"uebersetzungen\":{\"name\":\"Striscia\"}} — Ende.";
    const r = parseResult(raw, ["name"]);
    expect(r.uebersetzungen.name).toBe("Striscia");
  });

  it("wirft UebersetzenError bei kaputtem JSON ohne Fallback", () => {
    expect(() => parseResult("nicht json", ["name"])).toThrow(UebersetzenError);
  });

  it("wirft UebersetzenError wenn Antwort kein Objekt ist", () => {
    expect(() => parseResult("[1,2,3]", ["name"])).toThrow(UebersetzenError);
  });

  it("nicht-string-Werte werden zu leeren Strings", () => {
    const raw = JSON.stringify({ uebersetzungen: { name: 42, info_kurz: null } });
    const r = parseResult(raw, ["name", "info_kurz"]);
    expect(r.uebersetzungen.name).toBe("");
    expect(r.uebersetzungen.info_kurz).toBe("");
  });
});
