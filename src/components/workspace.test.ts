import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getWorkspaceForPath, getWorkspaceById, WORKSPACES } from "./workspace";

describe("getWorkspaceForPath", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("matches root path to start workspace", () => {
    expect(getWorkspaceForPath("/").id).toBe("start");
  });

  it("matches empty string to start workspace", () => {
    expect(getWorkspaceForPath("").id).toBe("start");
  });

  it.each([
    "/bereiche",
    "/bereiche/abc-123",
    "/bereiche/neu",
    "/kategorien",
    "/kategorien/foo/bearbeiten",
    "/produkte",
    "/produkte/abc-123/datenblatt",
    "/produkte/import",
    "/produkte/vergleich",
    "/mediathek",
    "/mediathek/dubletten",
    "/icons",
    "/icons/neu",
    "/datenblatt-vorlagen",
    "/datenblatt-vorlagen/abc",
    "/export",
    "/export/katalog",
  ])("matches %s to loesungen workspace", (path) => {
    expect(getWorkspaceForPath(path).id).toBe("loesungen");
  });

  it.each([
    "/kunden",
    "/kunden/K-0042",
    "/kunden/K-0042/preise",
    "/kunden/druckhistorie",
    "/kunden/sonderpreise",
    "/kunden/branchen",
  ])("matches %s to kunden workspace", (path) => {
    expect(getWorkspaceForPath(path).id).toBe("kunden");
  });

  it.each([
    "/einstellungen",
    "/benutzer",
    "/benutzer/profil",
    "/aktivitaet",
    "/hilfe",
  ])("matches %s to einstellungen workspace", (path) => {
    expect(getWorkspaceForPath(path).id).toBe("einstellungen");
  });

  it("falls back to start for unknown paths", () => {
    expect(getWorkspaceForPath("/nichts-was-existiert").id).toBe("start");
  });

  it("does not match prefix-incomplete paths", () => {
    expect(getWorkspaceForPath("/kundennummer").id).toBe("start");
    expect(getWorkspaceForPath("/bereich").id).toBe("start");
  });
});

describe("getWorkspaceById", () => {
  it("returns the workspace for a known id", () => {
    expect(getWorkspaceById("kunden").label).toBe("Kunden");
  });

  it("throws for an unknown id", () => {
    expect(() => getWorkspaceById("foo" as never)).toThrow();
  });
});

describe("WORKSPACES", () => {
  it("has exactly four workspaces", () => {
    expect(WORKSPACES).toHaveLength(4);
  });

  it("has unique ids", () => {
    const ids = WORKSPACES.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has start as first workspace", () => {
    expect(WORKSPACES[0].id).toBe("start");
  });
});
