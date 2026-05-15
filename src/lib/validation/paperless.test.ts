import { describe, it, expect } from "vitest";
import {
  paperlessVerbindungSchema,
  paperlessSyncFilterSchema,
} from "./paperless";

describe("paperlessVerbindungSchema", () => {
  it("akzeptiert gültige HTTPS-URL + Token", () => {
    const r = paperlessVerbindungSchema.safeParse({
      base_url: "https://paperless.example.com",
      token: "abc123token",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.base_url).toBe("https://paperless.example.com");
      expect(r.data.token).toBe("abc123token");
    }
  });

  it("entfernt trailing slashes der Basis-URL", () => {
    const r = paperlessVerbindungSchema.safeParse({
      base_url: "https://paperless.example.com///",
      token: "x",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.base_url).toBe("https://paperless.example.com");
    }
  });

  it("akzeptiert leeren Token (unverändert) als undefined", () => {
    const r = paperlessVerbindungSchema.safeParse({
      base_url: "https://paperless.example.com",
      token: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.token).toBeUndefined();
  });

  it("lehnt ungültige URL ab", () => {
    const r = paperlessVerbindungSchema.safeParse({
      base_url: "nicht-eine-url",
      token: "x",
    });
    expect(r.success).toBe(false);
  });

  it("lehnt nicht-http(s)-Protokoll ab", () => {
    const r = paperlessVerbindungSchema.safeParse({
      base_url: "ftp://paperless.example.com",
      token: "x",
    });
    expect(r.success).toBe(false);
  });

  it("lehnt leere Basis-URL ab", () => {
    const r = paperlessVerbindungSchema.safeParse({
      base_url: "",
      token: "x",
    });
    expect(r.success).toBe(false);
  });
});

describe("paperlessSyncFilterSchema", () => {
  it("akzeptiert leeren Filter", () => {
    const r = paperlessSyncFilterSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("akzeptiert gültigen Datums-Filter", () => {
    const r = paperlessSyncFilterSchema.safeParse({
      von: "2026-01-01",
      bis: "2026-12-31",
      tag: "Steuer",
      korrespondent: "Telekom",
    });
    expect(r.success).toBe(true);
  });

  it("lehnt ungültiges Datumsformat ab", () => {
    const r = paperlessSyncFilterSchema.safeParse({ von: "01.01.2026" });
    expect(r.success).toBe(false);
  });

  it("lehnt von > bis ab", () => {
    const r = paperlessSyncFilterSchema.safeParse({
      von: "2026-12-31",
      bis: "2026-01-01",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["bis"]);
    }
  });

  it("normalisiert leere Strings zu undefined", () => {
    const r = paperlessSyncFilterSchema.safeParse({
      von: "",
      tag: "",
      korrespondent: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.von).toBeUndefined();
      expect(r.data.tag).toBeUndefined();
      expect(r.data.korrespondent).toBeUndefined();
    }
  });
});
