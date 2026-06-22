// PROJ-15 P2 (#1): Tests für den Re-Klassifizierungs-Hook.
// Deckt Auswahl-Guards (leer / > MAX), Erfolgs- und Fehlerpfade (409, !ok,
// Netzwerk) sowie das korrekte Request-Format (buchung_ids) ab.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { useReklassifizierung, MAX_REKLASS_IDS } from "./use-reklassifizierung";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("useReklassifizierung", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    vi.restoreAllMocks();
  });

  it("lehnt eine leere Auswahl ab, ohne zu fetchen", async () => {
    const f = mockFetch(200, {});
    const { result } = renderHook(() => useReklassifizierung());

    let ok = true;
    await act(async () => {
      ok = await result.current.reklassifiziere([]);
    });

    expect(ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Keine Buchungen ausgewählt.");
  });

  it("lehnt mehr als MAX_REKLASS_IDS ab", async () => {
    const f = mockFetch(200, {});
    const { result } = renderHook(() => useReklassifizierung());
    const ids = Array.from({ length: MAX_REKLASS_IDS + 1 }, (_, i) => `id-${i}`);

    let ok = true;
    await act(async () => {
      ok = await result.current.reklassifiziere(ids);
    });

    expect(ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it("POSTet eindeutige buchung_ids und meldet Erfolg", async () => {
    const f = mockFetch(200, {
      ergebnis: { verarbeitet: 2, auto_verbucht: 1, zur_pruefung: 1 },
    });
    const { result } = renderHook(() => useReklassifizierung());

    let ok = false;
    await act(async () => {
      // Duplikat wird dedupliziert.
      ok = await result.current.reklassifiziere(["a", "a", "b"]);
    });

    expect(ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    const [, init] = f.mock.calls[0];
    expect((init as RequestInit).method).toBe("POST");
    const payload = JSON.parse((init as RequestInit).body as string);
    expect(payload).toEqual({ buchung_ids: ["a", "b"] });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("behandelt 409 (läuft bereits) als Fehler", async () => {
    mockFetch(409, { error: "Läuft bereits." });
    const { result } = renderHook(() => useReklassifizierung());

    let ok = true;
    await act(async () => {
      ok = await result.current.reklassifiziere(["a"]);
    });

    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalledWith("Läuft bereits.");
  });

  it("meldet einen Server-Fehler (!ok)", async () => {
    mockFetch(500, { error: "Kaputt." });
    const { result } = renderHook(() => useReklassifizierung());

    let ok = true;
    await act(async () => {
      ok = await result.current.reklassifiziere(["a"]);
    });

    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalledWith("Kaputt.");
  });

  it("fängt Netzwerkfehler ab", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("net")) as unknown as typeof fetch;
    const { result } = renderHook(() => useReklassifizierung());

    let ok = true;
    await act(async () => {
      ok = await result.current.reklassifiziere(["a"]);
    });

    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalledWith(
      "Netzwerkfehler bei der Re-Klassifizierung.",
    );
  });
});
