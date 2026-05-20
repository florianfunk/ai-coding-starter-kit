// PROJ-15 — Tests fuer `extrahiereBrancheUndLeistung`.
//
// Wir mocken den Vercel-AI-SDK-Aufruf (`generateObject`) und die
// Key-Aufloesung (`ladeAiKey`). Damit testet der Suite ausschliesslich die
// Glue-Logik in `web-research.ts` (Snippet-Block-Aufbau, Timeout-Verhalten,
// Trim/null-Normalisierung, Robustheit gegen Fehler).

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WebRechercheTreffer } from "./web-research";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Hoist-safe Mock-Funktionen, damit wir das Verhalten je Test umkonfigurieren
// koennen, ohne `vi.doMock` zu brauchen.
const generateObjectMock = vi.fn();
const ladeAiKeyMock = vi.fn();

vi.mock("ai", () => ({
  createGateway: () => () => "gateway-model" as unknown,
  // Wir liefern eine Funktion, die einen LanguageModel-ersatz liefert.
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
  NoObjectGeneratedError: class extends Error {
    static isInstance() {
      return false;
    }
  },
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: () => () => "anthropic-model" as unknown,
}));

vi.mock("@/lib/admin/ai-key", () => ({
  ladeAiKey: () => ladeAiKeyMock(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const snippets: WebRechercheTreffer[] = [
  {
    titel: "enercity AG",
    beschreibung: "enercity ist der regionale Energieversorger in Hannover.",
    url: "https://www.enercity.de",
  },
  {
    titel: "Strom & Gas | enercity",
    beschreibung: "Strom- und Gasangebote fuer Privatkunden und Gewerbe.",
    url: "https://www.enercity.de/strom",
  },
  {
    titel: "enercity Kontakt",
    beschreibung: "Hauptsitz in Hannover.",
    url: "https://www.enercity.de/kontakt",
  },
];

describe("extrahiereBrancheUndLeistung", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    ladeAiKeyMock.mockReset();
    ladeAiKeyMock.mockResolvedValue({
      key: "sk-ant-test",
      model: "anthropic/claude-haiku-4-5",
      quelle: "env",
    });
  });

  it("happy path: liefert Branche + Leistung", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        branche: "Stromversorgung",
        leistung: "Stromlieferant in Hannover und Umgebung.",
      },
    });

    const { extrahiereBrancheUndLeistung } = await import("./web-research");
    const res = await extrahiereBrancheUndLeistung(snippets, "enercity AG");

    expect(res).toEqual({
      branche: "Stromversorgung",
      leistung: "Stromlieferant in Hannover und Umgebung.",
    });
    expect(generateObjectMock).toHaveBeenCalledOnce();
  });

  it("trimmt Whitespace und normalisiert leere Strings auf null", async () => {
    generateObjectMock.mockResolvedValue({
      object: { branche: "  Zahlungsdienstleister  ", leistung: "   " },
    });
    const { extrahiereBrancheUndLeistung } = await import("./web-research");
    const res = await extrahiereBrancheUndLeistung(snippets, "PayPal");
    expect(res).toEqual({
      branche: "Zahlungsdienstleister",
      leistung: null,
    });
  });

  it("LLM liefert null/null → wird unveraendert durchgereicht", async () => {
    generateObjectMock.mockResolvedValue({
      object: { branche: null, leistung: null },
    });
    const { extrahiereBrancheUndLeistung } = await import("./web-research");
    const res = await extrahiereBrancheUndLeistung(snippets, "Acme GmbH");
    expect(res).toEqual({ branche: null, leistung: null });
  });

  it("leeres Snippets-Array → kein LLM-Call, null", async () => {
    const { extrahiereBrancheUndLeistung } = await import("./web-research");
    const res = await extrahiereBrancheUndLeistung([], "Acme GmbH");
    expect(res).toBeNull();
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("LLM wirft Fehler → null (kein Throw nach aussen)", async () => {
    generateObjectMock.mockRejectedValue(new Error("LLM down"));
    const { extrahiereBrancheUndLeistung } = await import("./web-research");
    const res = await extrahiereBrancheUndLeistung(snippets, "Acme GmbH");
    expect(res).toBeNull();
  });

  it("kein AI-Key konfiguriert → null (kein LLM-Call)", async () => {
    ladeAiKeyMock.mockResolvedValue({ key: null, model: "x", quelle: null });
    const { extrahiereBrancheUndLeistung } = await import("./web-research");
    const res = await extrahiereBrancheUndLeistung(snippets, "Acme GmbH");
    expect(res).toBeNull();
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("ladeAiKey wirft → null (Robustheit)", async () => {
    ladeAiKeyMock.mockRejectedValue(new Error("DB down"));
    const { extrahiereBrancheUndLeistung } = await import("./web-research");
    const res = await extrahiereBrancheUndLeistung(snippets, "Acme GmbH");
    expect(res).toBeNull();
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("Timeout greift, wenn LLM laenger braucht als opts.timeoutMs", async () => {
    // generateObject haengt sehr lange — Race-Timeout muss greifen.
    generateObjectMock.mockImplementation(
      () => new Promise(() => undefined), // never resolves
    );
    const { extrahiereBrancheUndLeistung } = await import("./web-research");
    const res = await extrahiereBrancheUndLeistung(
      snippets,
      "Acme GmbH",
      { timeoutMs: 20 },
    );
    expect(res).toBeNull();
  });

  it("Gateway-Pfad: nicht-Anthropic-Key → wahlt Gateway, ruft trotzdem auf", async () => {
    ladeAiKeyMock.mockResolvedValue({
      key: "vck_abc123",
      model: "anthropic/claude-haiku-4-5",
      quelle: "env",
    });
    generateObjectMock.mockResolvedValue({
      object: { branche: "Cloud", leistung: "SaaS-Anbieter." },
    });
    const { extrahiereBrancheUndLeistung } = await import("./web-research");
    const res = await extrahiereBrancheUndLeistung(snippets, "Acme GmbH");
    expect(res).toEqual({ branche: "Cloud", leistung: "SaaS-Anbieter." });
  });
});
