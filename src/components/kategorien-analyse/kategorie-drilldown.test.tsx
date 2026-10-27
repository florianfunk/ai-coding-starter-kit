import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { KategorieDrilldown } from "./kategorie-drilldown";
import type { KategorieAggregat } from "@/app/api/kategorien-analyse/route";

vi.mock("@/components/kategorien-analyse/buchung-detail-sheet", () => ({ BuchungDetailSheet: () => null }));
vi.mock("@/components/kategorien/kategorie-combobox", () => ({
  KategorieCombobox: ({ kategorien, value, onChange, ariaLabel, disabled }: {
    kategorien: { id: string; bezeichnung: string }[]; value: string; onChange: (v: string) => void;
    ariaLabel: string; disabled?: boolean;
  }) => <select aria-label={ariaLabel} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
    <option value="">Wählen</option>
    {kategorien.map((k) => <option key={k.id} value={k.id}>{k.bezeichnung}</option>)}
  </select>,
}));

const rows = ["Firma A", "Firma B"].map((empfaenger, i) => ({
  id: `booking-${i}`, empfaenger, buchung_datum: "2025-11-27", betrag: 119,
  kategorie_id: "income", klassifikation: "geschaeftlich", steuerrelevant: true,
  ust_satz: 19, konfidenz: 0.95, status: "auto_verbucht", verwendungszweck: null,
}));
const fetchMock = vi.fn();
const mutiert = vi.fn();
let failWrite = false;

beforeEach(() => {
  failWrite = false;
  mutiert.mockReset();
  fetchMock.mockReset().mockImplementation(async (url: string, options?: RequestInit) => {
    if (options?.method === "POST") return { ok: !failWrite, status: failWrite ? 500 : 200,
      json: async () => failWrite ? { error: "Speichern fehlgeschlagen" } : {
        aktualisiert: JSON.parse(String(options.body)).ids.length, uebersprungen: [],
        kategorie: { id: "private", bezeichnung: "Privat: Sonstige Ausgaben", typ: "privat" },
      } };
    return { ok: true, json: async () => url.includes("/buchungen?") ? { buchungen: rows } : { data: [
      { id: "income", bezeichnung: "Erlöse", typ: "einnahme", aktiv: true },
      { id: "private", bezeichnung: "Privat: Sonstige Ausgaben", typ: "privat", aktiv: true },
      { id: "inactive", bezeichnung: "Inaktiv privat", typ: "privat", aktiv: false },
    ] } };
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function open() {
  render(<KategorieDrilldown kategorie={{ kategorie_id: "income", bezeichnung: "Erlöse", anzahl: 2,
    summe: 238, konfidenz_avg: 0.95 } as KategorieAggregat}
    von="2025-01-01" bis="2025-12-31" kontoId={null} nurSteuerrelevant onClose={vi.fn()} onMutiert={mutiert} />);
  await screen.findByText("Firma A", { exact: true });
  await waitFor(() => expect(screen.getByRole("button", { name: "Als privat buchen: Firma A" })).toBeEnabled());
}

describe("Kategorieansicht: privat umbuchen", () => {
  it("bucht nur die gewählte Zeile in eine aktive Privatkategorie um", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Als privat buchen: Firma A" }));
    const dialog = screen.getByRole("dialog", { name: "Als privat buchen" });
    const confirm = within(dialog).getByRole("button", { name: "Als privat buchen" });
    expect(confirm).toBeDisabled();
    const category = within(dialog).getByLabelText("Privatkategorie wählen");
    expect(within(category).queryByRole("option", { name: "Erlöse" })).not.toBeInTheDocument();
    expect(within(category).queryByRole("option", { name: "Inaktiv privat" })).not.toBeInTheDocument();
    fireEvent.change(category, { target: { value: "private" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(mutiert).toHaveBeenCalledOnce());
    const call = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(call?.[0]).toBe("/api/buchungen/bulk-kategorie");
    expect(JSON.parse(call?.[1].body)).toEqual({ ids: ["booking-0"], kategorie_id: "private" });
    expect(screen.queryByText("Firma A", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText("Firma B", { exact: true })).toBeVisible();
  });

  it("übernimmt genau die Mehrfachauswahl und schreibt beim Abbrechen nichts", async () => {
    await open();
    fireEvent.click(screen.getByRole("checkbox", { name: "Alle auswählen" }));
    fireEvent.click(screen.getByRole("button", { name: "Auswahl als privat buchen" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Als privat buchen" })).getByRole("button", { name: "Abbrechen" }));
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Auswahl als privat buchen" }));
    const dialog = screen.getByRole("dialog", { name: "Als privat buchen" });
    fireEvent.change(within(dialog).getByLabelText("Privatkategorie wählen"), { target: { value: "private" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Als privat buchen" }));
    await waitFor(() => expect(mutiert).toHaveBeenCalledOnce());
    const call = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
    expect(JSON.parse(call?.[1].body).ids).toEqual(["booking-0", "booking-1"]);
  });

  it("behält Buchungen und Dialog bei einem Speicherfehler", async () => {
    failWrite = true;
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Als privat buchen: Firma A" }));
    const dialog = screen.getByRole("dialog", { name: "Als privat buchen" });
    fireEvent.change(within(dialog).getByLabelText("Privatkategorie wählen"), { target: { value: "private" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Als privat buchen" }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Als privat buchen" })).toBeEnabled());
    expect(mutiert).not.toHaveBeenCalled();
    expect(screen.getByText("Firma A", { exact: true })).toBeInTheDocument();
  });
});
