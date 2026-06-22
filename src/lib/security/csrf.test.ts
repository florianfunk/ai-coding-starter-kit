import { describe, it, expect } from "vitest";
import { pruefeCsrf } from "./csrf";

function req(
  method: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://app.example.com/api/x", { method, headers });
}

describe("pruefeCsrf", () => {
  it("lässt sichere Methoden immer zu", () => {
    expect(pruefeCsrf(req("GET")).ok).toBe(true);
    expect(pruefeCsrf(req("HEAD")).ok).toBe(true);
    expect(pruefeCsrf(req("OPTIONS")).ok).toBe(true);
  });

  it("erlaubt POST mit passendem Origin/Host", () => {
    expect(
      pruefeCsrf(
        req("POST", {
          origin: "https://app.example.com",
          host: "app.example.com",
        }),
      ).ok,
    ).toBe(true);
  });

  it("blockiert POST mit fremdem Origin", () => {
    const r = pruefeCsrf(
      req("POST", {
        origin: "https://angreifer.example.org",
        host: "app.example.com",
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.grund).toBeDefined();
  });

  it("blockiert ungültigen Origin-Header", () => {
    expect(pruefeCsrf(req("POST", { origin: "kein-url", host: "app.example.com" })).ok).toBe(
      false,
    );
  });

  it("nutzt Sec-Fetch-Site, wenn kein Origin gesetzt ist", () => {
    expect(pruefeCsrf(req("POST", { "sec-fetch-site": "same-origin" })).ok).toBe(true);
    expect(pruefeCsrf(req("POST", { "sec-fetch-site": "none" })).ok).toBe(true);
    expect(pruefeCsrf(req("POST", { "sec-fetch-site": "cross-site" })).ok).toBe(false);
    expect(pruefeCsrf(req("POST", { "sec-fetch-site": "same-site" })).ok).toBe(false);
  });

  it("lässt Anfragen ohne Browser-Header zu (Server-zu-Server)", () => {
    expect(pruefeCsrf(req("DELETE")).ok).toBe(true);
  });
});
