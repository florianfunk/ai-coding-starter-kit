// PROJ-15 (Konsistenz-Pro) — Retry-Tests fuer `klassifiziereMitLlm`.
//
// Wir mocken die Vercel-AI-SDK-Bausteine (`generateObject`,
// `NoObjectGeneratedError`, `APICallError`) und die Key-Aufloesung
// (`ladeAiKey`). Damit testen wir genau das Retry-Verhalten, ohne reale
// LLM-Calls.

import { describe, expect, it, vi, beforeEach } from "vitest";

const generateObjectMock = vi.fn();
const ladeAiKeyMock = vi.fn();

// Fake-Klassen fuer NoObjectGeneratedError + APICallError, damit
// `isInstance` deterministisch funktioniert. Beide Klassen mimen exakt das
// SDK-API (`isInstance`-Static-Methode), ohne den vollen `AISDKError`-Stack
// nachzubauen.
class FakeNoObject extends Error {
  static isInstance(err: unknown): err is FakeNoObject {
    return err instanceof FakeNoObject;
  }
}

class FakeApiCall extends Error {
  public statusCode?: number;
  public isRetryable: boolean;
  constructor(opts: { message: string; statusCode?: number; isRetryable?: boolean }) {
    super(opts.message);
    this.statusCode = opts.statusCode;
    this.isRetryable = opts.isRetryable ?? true;
  }
  static isInstance(err: unknown): err is FakeApiCall {
    return err instanceof FakeApiCall;
  }
}

vi.mock("ai", () => ({
  createGateway: () => () => "gateway-model" as unknown,
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
  NoObjectGeneratedError: FakeNoObject,
  APICallError: FakeApiCall,
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: () => () => "anthropic-model" as unknown,
}));

vi.mock("@/lib/admin/ai-key", () => ({
  ladeAiKey: () => ladeAiKeyMock(),
}));

// Realistische Mini-Kategorien.
const kategorien = [
  { id: "kat-soft", bezeichnung: "Software", typ: "ausgabe" as const },
];

const erfolgsObjekt = {
  klassifikation: "geschaeftlich" as const,
  steuerrelevant: true,
  kategorie_id: "kat-soft",
  ust_satz: 19 as const,
  begruendung: "Software-Abo, betrieblich.",
  konfidenz: 0.92,
};

const eingabe = {
  verwendungszweck: "Adobe CC",
  betrag: -59.99,
  empfaenger: "Adobe Systems",
};

describe("klassifiziereMitLlm — Retry-Mechanismus", () => {
  beforeEach(async () => {
    generateObjectMock.mockReset();
    ladeAiKeyMock.mockReset();
    ladeAiKeyMock.mockResolvedValue({
      key: "sk-ant-test",
      model: "anthropic/claude-haiku-4-5",
      quelle: "env",
    });
    // Retry-Sleeps in Tests auf 0 setzen — produktive 800ms machen die
    // Test-Suite langsam, ohne fachlichen Wert.
    const { _setRetryDelayForTest } = await import("./llm");
    _setRetryDelayForTest(0);
  });

  it("Initialer Versuch erfolgreich → retries=0, ein generateObject-Call", async () => {
    generateObjectMock.mockResolvedValueOnce({ object: erfolgsObjekt });

    const { klassifiziereMitLlm } = await import("./llm");
    const erg = await klassifiziereMitLlm(eingabe, kategorien);

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    expect(erg.retries).toBe(0);
    expect(erg.klassifikation).toBe("geschaeftlich");
    expect(erg.kategorie_id).toBe("kat-soft");
  });

  it("Erster Call wirft NoObjectGeneratedError → zweiter Call erfolgreich, retries=1", async () => {
    generateObjectMock
      .mockRejectedValueOnce(new FakeNoObject("Schema-Mismatch"))
      .mockResolvedValueOnce({ object: erfolgsObjekt });

    const { klassifiziereMitLlm } = await import("./llm");
    const erg = await klassifiziereMitLlm(eingabe, kategorien);

    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(erg.retries).toBe(1);
    expect(erg.klassifikation).toBe("geschaeftlich");

    // Der zweite Call soll ein verschaerftes System-Prompt bekommen
    // ("Antworte STRENG nach dem JSON-Schema. ...").
    const zweiterCall = generateObjectMock.mock.calls[1][0] as { system: string };
    expect(zweiterCall.system).toMatch(/STRENG nach dem JSON-Schema/i);
  });

  it("Beide Calls werfen NoObjectGeneratedError → LlmKlassifiziererError mit retries=1", async () => {
    generateObjectMock
      .mockRejectedValueOnce(new FakeNoObject("Schema-Mismatch 1"))
      .mockRejectedValueOnce(new FakeNoObject("Schema-Mismatch 2"));

    const { klassifiziereMitLlm, LlmKlassifiziererError } = await import("./llm");

    try {
      await klassifiziereMitLlm(eingabe, kategorien);
      expect.fail("Sollte werfen.");
    } catch (err) {
      expect(err).toBeInstanceOf(LlmKlassifiziererError);
      const e = err as InstanceType<typeof LlmKlassifiziererError>;
      expect(e.retries).toBe(1);
      expect(e.message).toMatch(/schemakonform/i);
    }
    expect(generateObjectMock).toHaveBeenCalledTimes(2);
  });

  it("APICallError 503 (5xx) → wird geretried, retries=1 bei finalem Erfolg", async () => {
    generateObjectMock
      .mockRejectedValueOnce(
        new FakeApiCall({ message: "Service Unavailable", statusCode: 503 }),
      )
      .mockResolvedValueOnce({ object: erfolgsObjekt });

    const { klassifiziereMitLlm } = await import("./llm");
    const erg = await klassifiziereMitLlm(eingabe, kategorien);

    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(erg.retries).toBe(1);
  });

  it("APICallError ohne Statuscode (Netzwerk/Timeout) → wird geretried", async () => {
    generateObjectMock
      .mockRejectedValueOnce(
        new FakeApiCall({ message: "Timeout", statusCode: undefined }),
      )
      .mockResolvedValueOnce({ object: erfolgsObjekt });

    const { klassifiziereMitLlm } = await import("./llm");
    const erg = await klassifiziereMitLlm(eingabe, kategorien);

    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(erg.retries).toBe(1);
  });

  it("APICallError 400 (4xx) → KEIN Retry, sofort LlmKlassifiziererError mit retries=0", async () => {
    generateObjectMock.mockRejectedValueOnce(
      new FakeApiCall({ message: "Bad Request", statusCode: 400 }),
    );

    const { klassifiziereMitLlm, LlmKlassifiziererError } = await import("./llm");

    try {
      await klassifiziereMitLlm(eingabe, kategorien);
      expect.fail("Sollte werfen.");
    } catch (err) {
      expect(err).toBeInstanceOf(LlmKlassifiziererError);
      const e = err as InstanceType<typeof LlmKlassifiziererError>;
      expect(e.retries).toBe(0);
    }
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("APICallError 401 (Auth) → KEIN Retry", async () => {
    generateObjectMock.mockRejectedValueOnce(
      new FakeApiCall({ message: "Unauthorized", statusCode: 401 }),
    );

    const { klassifiziereMitLlm } = await import("./llm");
    await expect(klassifiziereMitLlm(eingabe, kategorien)).rejects.toThrow();
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("APICallError mit isRetryable=false → KEIN Retry, auch bei 5xx", async () => {
    generateObjectMock.mockRejectedValueOnce(
      new FakeApiCall({
        message: "Server Error (terminal)",
        statusCode: 502,
        isRetryable: false,
      }),
    );

    const { klassifiziereMitLlm } = await import("./llm");
    await expect(klassifiziereMitLlm(eingabe, kategorien)).rejects.toThrow();
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("Unbekannter Error (kein NoObject, kein APICall) → KEIN Retry, durchgereicht als LlmKlassifiziererError", async () => {
    generateObjectMock.mockRejectedValueOnce(new Error("Wat?"));

    const { klassifiziereMitLlm, LlmKlassifiziererError } = await import("./llm");
    try {
      await klassifiziereMitLlm(eingabe, kategorien);
      expect.fail("Sollte werfen.");
    } catch (err) {
      expect(err).toBeInstanceOf(LlmKlassifiziererError);
      const e = err as InstanceType<typeof LlmKlassifiziererError>;
      expect(e.retries).toBe(0);
      expect(e.message).toMatch(/LLM-Aufruf fehlgeschlagen/i);
    }
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("Kein API-Key → sofortiger LlmKlassifiziererError ohne generateObject-Call", async () => {
    ladeAiKeyMock.mockReset();
    ladeAiKeyMock.mockResolvedValue({ key: null, model: "", quelle: "env" });

    const { klassifiziereMitLlm, LlmKlassifiziererError } = await import("./llm");
    await expect(klassifiziereMitLlm(eingabe, kategorien)).rejects.toBeInstanceOf(
      LlmKlassifiziererError,
    );
    expect(generateObjectMock).not.toHaveBeenCalled();
  });
});

describe("istRetryFaehig — reine Klassifikation der Fehler", () => {
  it("NoObjectGeneratedError → true", async () => {
    const { istRetryFaehig } = await import("./llm");
    expect(istRetryFaehig(new FakeNoObject("x"))).toBe(true);
  });

  it("APICallError 500 → true", async () => {
    const { istRetryFaehig } = await import("./llm");
    expect(
      istRetryFaehig(new FakeApiCall({ message: "x", statusCode: 500 })),
    ).toBe(true);
  });

  it("APICallError 499 → false", async () => {
    const { istRetryFaehig } = await import("./llm");
    expect(
      istRetryFaehig(new FakeApiCall({ message: "x", statusCode: 499 })),
    ).toBe(false);
  });

  it("APICallError ohne Statuscode → true", async () => {
    const { istRetryFaehig } = await import("./llm");
    expect(
      istRetryFaehig(new FakeApiCall({ message: "x", statusCode: undefined })),
    ).toBe(true);
  });

  it("Plain Error → false", async () => {
    const { istRetryFaehig } = await import("./llm");
    expect(istRetryFaehig(new Error("plain"))).toBe(false);
  });
});
