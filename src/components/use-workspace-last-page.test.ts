import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWorkspaceLastPage } from "./use-workspace-last-page";

const STORAGE_KEY = "lichtengros.workspace.last-page";

const pathnameMock = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    store = {};
  }),
};

beforeEach(() => {
  store = {};
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
  pathnameMock.mockReturnValue("/");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useWorkspaceLastPage", () => {
  it("schreibt aktuellen Pfad in localStorage beim Mount", () => {
    pathnameMock.mockReturnValue("/produkte");
    renderHook(() => useWorkspaceLastPage());
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.loesungen).toBe("/produkte");
  });

  it("schreibt root-Pfad als start-Workspace", () => {
    pathnameMock.mockReturnValue("/");
    renderHook(() => useWorkspaceLastPage());
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored.start).toBe("/");
  });

  it("aktualisiert localStorage, wenn pathname sich ändert", () => {
    pathnameMock.mockReturnValue("/bereiche");
    const { rerender } = renderHook(() => useWorkspaceLastPage());
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).loesungen).toBe("/bereiche");

    pathnameMock.mockReturnValue("/produkte");
    rerender();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).loesungen).toBe("/produkte");
  });

  it("getTargetForWorkspace liefert gespeicherten Pfad zurück", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ loesungen: "/produkte/abc-123" }),
    );
    pathnameMock.mockReturnValue("/");
    const { result } = renderHook(() => useWorkspaceLastPage());
    expect(result.current.getTargetForWorkspace("loesungen")).toBe("/produkte/abc-123");
  });

  it("getTargetForWorkspace fällt auf landingPath zurück, wenn nichts gespeichert", () => {
    pathnameMock.mockReturnValue("/");
    const { result } = renderHook(() => useWorkspaceLastPage());
    expect(result.current.getTargetForWorkspace("loesungen")).toBe("/bereiche");
    expect(result.current.getTargetForWorkspace("kunden")).toBe("/kunden");
    expect(result.current.getTargetForWorkspace("einstellungen")).toBe("/einstellungen");
    expect(result.current.getTargetForWorkspace("start")).toBe("/");
  });

  it("ignoriert kaputtes JSON in localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not valid json");
    pathnameMock.mockReturnValue("/");
    const { result } = renderHook(() => useWorkspaceLastPage());
    expect(result.current.getTargetForWorkspace("kunden")).toBe("/kunden");
  });

  it("ignoriert null als JSON-Wert", () => {
    window.localStorage.setItem(STORAGE_KEY, "null");
    pathnameMock.mockReturnValue("/");
    const { result } = renderHook(() => useWorkspaceLastPage());
    expect(result.current.getTargetForWorkspace("loesungen")).toBe("/bereiche");
  });

  it("schreibt nicht erneut, wenn derselbe Pfad bereits gespeichert ist", () => {
    pathnameMock.mockReturnValue("/produkte");
    const { rerender } = renderHook(() => useWorkspaceLastPage());
    const callsAfterFirst = localStorageMock.setItem.mock.calls.length;

    rerender();
    expect(localStorageMock.setItem.mock.calls.length).toBe(callsAfterFirst);
  });

  it("speichert getrennte Einträge pro Workspace", () => {
    pathnameMock.mockReturnValue("/produkte");
    const { rerender } = renderHook(() => useWorkspaceLastPage());

    pathnameMock.mockReturnValue("/kunden/K-0042");
    rerender();

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.loesungen).toBe("/produkte");
    expect(stored.kunden).toBe("/kunden/K-0042");
  });

  it("übersteht localStorage-Schreibfehler ohne Crash", () => {
    pathnameMock.mockReturnValue("/produkte");
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error("QuotaExceeded");
    });

    expect(() => {
      renderHook(() => useWorkspaceLastPage());
    }).not.toThrow();
  });

  it("getTargetForWorkspace fällt auf landingPath zurück, wenn localStorage-Lese-Fehler wirft", () => {
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error("SecurityError");
    });

    pathnameMock.mockReturnValue("/");
    const { result } = renderHook(() => useWorkspaceLastPage());
    expect(result.current.getTargetForWorkspace("kunden")).toBe("/kunden");
  });

  it("Tiefen-URL wird für richtigen Workspace gespeichert", () => {
    pathnameMock.mockReturnValue("/kunden/K-0042/preise");
    renderHook(() => useWorkspaceLastPage());
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.kunden).toBe("/kunden/K-0042/preise");
    expect(stored.loesungen).toBeUndefined();
  });

  it("vorhandene andere Workspace-Einträge bleiben erhalten beim Update", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ kunden: "/kunden/K-0042", einstellungen: "/benutzer" }),
    );
    pathnameMock.mockReturnValue("/produkte");
    renderHook(() => useWorkspaceLastPage());
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.kunden).toBe("/kunden/K-0042");
    expect(stored.einstellungen).toBe("/benutzer");
    expect(stored.loesungen).toBe("/produkte");
  });
});
