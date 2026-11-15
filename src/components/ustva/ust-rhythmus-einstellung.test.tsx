import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import { UstRhythmusEinstellung } from "./ust-rhythmus-einstellung";
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("bietet die monatliche Abgabe ab April 2026 mit explizitem Speichern an", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ profil: {} }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<UstRhythmusEinstellung rhythmus="quartalsweise" vorher={null} gueltigAb={null} jahr={2026} />);
  fireEvent.click(screen.getByRole("button", { name: "Abgaberhythmus ändern" }));
  expect(screen.getByLabelText("Monatlich ab")).toHaveValue("2026-04-01");
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Auf monatlich umstellen" }));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(fetchMock).toHaveBeenCalledWith("/api/firma/ust-rhythmus", expect.objectContaining({
    method: "PATCH", body: JSON.stringify({ rhythmus_gueltig_ab: "2026-04-01" }),
  }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("zeigt einen Abschlusskonflikt und lässt den Dialog offen", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Q2 ist bereits abgeschlossen." }) }));
  render(<UstRhythmusEinstellung rhythmus="quartalsweise" vorher={null} gueltigAb={null} jahr={2026} />);
  fireEvent.click(screen.getByRole("button", { name: "Abgaberhythmus ändern" }));
  fireEvent.click(screen.getByRole("button", { name: "Auf monatlich umstellen" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Q2 ist bereits abgeschlossen."));
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeVisible();
});

it("zeigt nach dem Wechsel die zeitliche Abgrenzung und erlaubt eine Terminkorrektur", () => {
  render(<UstRhythmusEinstellung rhythmus="monatlich" vorher="quartalsweise" gueltigAb="2026-04-01" jahr={2026} />);
  expect(screen.getByText(/Monatliche Abgabe ab 01.04.2026/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Wechseltermin ändern" }));
  expect(screen.getByLabelText("Monatlich ab")).toHaveValue("2026-04-01");
  expect(screen.getByRole("button", { name: "Wechseltermin speichern" })).toBeEnabled();
});
