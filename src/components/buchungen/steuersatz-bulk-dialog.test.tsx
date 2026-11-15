import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { SteuersatzBulkDialog } from "./steuersatz-bulk-dialog";

const ids = Array.from({ length: 501 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
const fetchMock = vi.fn();

function antwort(aktualisiert: number, uebersprungen: string[] = []) {
  return { ok: true, json: async () => ({ aktualisiert, uebersprungen, ust_satz: 19 }) };
}

function waehlen(option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Neuer Steuersatz" }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Sammeländerung des Steuersatzes", () => {
  it.each([["19 %", 19], ["7 %", 7], ["0 %", 0], ["Kein Steuersatz", null]] as const)(
    "speichert %s erst nach ausdrücklicher Auswahl und Bestätigung", async (option, satz) => {
      const onClose = vi.fn();
      const onAktualisiert = vi.fn();
      fetchMock.mockResolvedValue(antwort(2));
      render(<SteuersatzBulkDialog ids={ids.slice(0, 2)} onClose={onClose} onAktualisiert={onAktualisiert} />);
      expect(screen.getByText(/Für 2 ausgewählte Buchungen/)).toBeVisible();
      expect(screen.getByRole("button", { name: "Steuersatz speichern" })).toBeDisabled();
      waehlen(option);
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Steuersatz speichern" }));
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/buchungen/bulk-ust", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids.slice(0, 2), ust_satz: satz }),
      });
      expect(onAktualisiert).toHaveBeenCalledWith(ids.slice(0, 2));
    },
  );

  it("verarbeitet mehr als 500 Buchungen in getrennten Requests", async () => {
    const onClose = vi.fn();
    fetchMock.mockResolvedValueOnce(antwort(500)).mockResolvedValueOnce(antwort(1));
    render(<SteuersatzBulkDialog ids={ids} onClose={onClose} onAktualisiert={vi.fn()} />);
    waehlen("19 %");
    fireEvent.click(screen.getByRole("button", { name: "Steuersatz speichern" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).ids).toEqual(ids.slice(0, 500));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).ids).toEqual(ids.slice(500));
    expect(toast.success).toHaveBeenCalledWith("501 Buchungen aktualisiert.");
  });

  it("behält bei einem Teilfehler den Fortschritt und wiederholt nur den fehlgeschlagenen Block", async () => {
    const onClose = vi.fn();
    const onAktualisiert = vi.fn();
    fetchMock.mockResolvedValueOnce(antwort(500)).mockResolvedValueOnce({
      ok: false, json: async () => ({ error: "Datenbank vorübergehend nicht erreichbar." }),
    });
    render(<SteuersatzBulkDialog ids={ids} onClose={onClose} onAktualisiert={onAktualisiert} />);
    waehlen("19 %");
    fireEvent.click(screen.getByRole("button", { name: "Steuersatz speichern" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Datenbank vorübergehend nicht erreichbar."));
    expect(screen.getByRole("status")).toHaveTextContent("500 von 501 Buchungen verarbeitet, 500 aktualisiert");
    expect(screen.getByRole("combobox", { name: "Neuer Steuersatz" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onAktualisiert).toHaveBeenCalledWith(ids.slice(0, 500));

    fetchMock.mockResolvedValueOnce(antwort(1));
    fireEvent.click(screen.getByRole("button", { name: "Steuersatz speichern" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).ids).toEqual(ids.slice(500));
    expect(toast.success).toHaveBeenCalledWith("501 Buchungen aktualisiert.");
  });

  it("meldet übersprungene Buchungen und gibt nur gespeicherte IDs zurück", async () => {
    const onAktualisiert = vi.fn();
    fetchMock.mockResolvedValueOnce(antwort(1, [ids[1]]));
    render(<SteuersatzBulkDialog ids={ids.slice(0, 2)} onClose={vi.fn()} onAktualisiert={onAktualisiert} />);
    waehlen("7 %");
    fireEvent.click(screen.getByRole("button", { name: "Steuersatz speichern" }));
    await waitFor(() => expect(onAktualisiert).toHaveBeenCalledWith([ids[0]]));
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("1 Buchung wurde"));
  });

  it("führt beim Abbrechen keine Änderung aus", () => {
    const onClose = vi.fn();
    render(<SteuersatzBulkDialog ids={[ids[0]]} onClose={onClose} onAktualisiert={vi.fn()} />);
    waehlen("19 %");
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verhindert doppelte Anfragen und das Schließen während des Speicherns", async () => {
    let fertig!: (value: ReturnType<typeof antwort>) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => { fertig = resolve; }));
    const onClose = vi.fn();
    render(<SteuersatzBulkDialog ids={[ids[0]]} onClose={onClose} onAktualisiert={vi.fn()} />);
    waehlen("19 %");
    fireEvent.click(screen.getByRole("button", { name: "Steuersatz speichern" }));
    expect(screen.getByRole("button", { name: "Wird gespeichert…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    fertig(antwort(1));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
