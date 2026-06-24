// PROJ-32 (AC2): Tests des Mail-Adapters — KEIN echter Netzwerk-Call.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { sendMail, type MailNachricht } from "./mailer";

const nachricht: MailNachricht = {
  an: "inhaber@example.de",
  betreff: "Test",
  text: "Text",
  html: "<p>Text</p>",
};

const ORIG = process.env.RESEND_API_KEY;

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  if (ORIG === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIG;
  vi.restoreAllMocks();
});

describe("sendMail", () => {
  it("no-op ohne RESEND_API_KEY (kein Fehler, gesendet=false)", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await sendMail(nachricht);
    expect(res.gesendet).toBe(false);
    expect(res.grund).toBe("kein_api_key");
    expect(logSpy).toHaveBeenCalledOnce();
  });

  it("nutzt injizierten Versender (DI) und sendet darüber", async () => {
    const versender = vi
      .fn()
      .mockResolvedValue({ gesendet: true, grund: "ok" });
    const res = await sendMail(nachricht, versender);
    expect(versender).toHaveBeenCalledWith(nachricht);
    expect(res).toEqual({ gesendet: true, grund: "ok" });
  });

  it("gibt Fehler des Versenders sauber zurück (kein Throw)", async () => {
    const versender = vi
      .fn()
      .mockResolvedValue({ gesendet: false, grund: "boom" });
    const res = await sendMail(nachricht, versender);
    expect(res.gesendet).toBe(false);
    expect(res.grund).toBe("boom");
  });
});
