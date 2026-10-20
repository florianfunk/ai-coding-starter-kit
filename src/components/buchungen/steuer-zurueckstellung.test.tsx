import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SteuerZurueckstellung } from "./steuer-zurueckstellung";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Rückstellung bedienen", () => {
  it("fordert einen Grund und sendet nur die Rückstellung", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetch);
    const gespeichert = vi.fn();
    render(<SteuerZurueckstellung buchung={{ id: "test", steuer_zurueckgestellt: false }} onGespeichert={gespeichert} />);
    expect(screen.getByRole("button", { name: "Für Steuer zurückstellen" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Grund für die Rückstellung"), { target: { value: " Rechnung strittig " } });
    fireEvent.click(screen.getByRole("button", { name: "Für Steuer zurückstellen" }));
    await waitFor(() => expect(gespeichert).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ aktion: "zurueckstellen", grund: "Rechnung strittig", erwartet_am: null });
  });
  it("zeigt den Grund, nimmt wieder auf und bewahrt einen Konflikthinweis", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Periode bereits abgeschlossen." }) });
    vi.stubGlobal("fetch", fetch);
    const gespeichert = vi.fn();
    render(<SteuerZurueckstellung buchung={{ id: "test", steuer_zurueckgestellt: true,
      steuer_zurueckgestellt_grund: "Rechnung strittig", steuer_zurueckgestellt_am: "2026-10-20T15:00:00Z" }} onGespeichert={gespeichert} />);
    expect(screen.getByText("Rechnung strittig", { exact: false })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Wieder aufnehmen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Periode bereits abgeschlossen.");
    expect(gespeichert).not.toHaveBeenCalled();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ aktion: "wiederaufnehmen", erwartet_am: "2026-10-20T15:00:00Z" });
  });
});
