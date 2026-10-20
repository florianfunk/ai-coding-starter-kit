import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Buchung } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
// Test the list's state transition independently of the shared form/dialog.
vi.mock("@/components/buchungen/buchung-detail-sheet", () => ({
  BuchungDetailSheet: ({ buchung, open, onOpenChange, onRueckstellungGespeichert }: {
    buchung: Buchung | null; open: boolean; onOpenChange: (open: boolean) => void;
    onRueckstellungGespeichert: (buchung: Partial<Buchung> & { id: string }) => void;
  }) => open && buchung ? <div>
    <p>{buchung.steuer_zurueckgestellt ? "Status zurückgestellt" : "Status aktiv"}</p>
    <button onClick={() => {
      onRueckstellungGespeichert({ id: buchung.id, steuer_zurueckgestellt: !buchung.steuer_zurueckgestellt,
        steuer_zurueckgestellt_grund: "Strittig", steuer_zurueckstellung_version: (buchung.steuer_zurueckstellung_version ?? 0) + 1 });
      onOpenChange(false);
    }}>Rückstellung wechseln</button>
  </div> : null,
}));

import { MerklisteAnsicht } from "@/components/merkliste/merkliste-ansicht";
import { PrueflisteAnsicht } from "@/components/pruefliste/pruefliste-ansicht";

const buchung = { id: "test", konto_id: "konto", buchung_datum: "2025-05-01", betrag: -119,
  empfaenger: "TEST Lieferant", verwendungszweck: "Rechnung", waehrung: "EUR", klassifikation: "geschaeftlich",
  steuerrelevant: true, ust_satz: 19, status: "zur_pruefung", kategorie_id: null, konfidenz: null,
  quelle: "ki", begruendung: "Prüfen", pruef_grund: "unklar", gemerkt_am: "2026-10-20T15:00:00Z",
  steuer_zurueckgestellt: false, steuer_zurueckstellung_version: 0 } as Buchung;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Listen nach Rückstellung", () => {
  it("zeigt in der Merkliste nach erneutem Öffnen den neuen Status und erlaubt Resume", () => {
    render(<MerklisteAnsicht initialBuchungen={[buchung]} konten={[]} kategorien={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /TEST Lieferant/ }));
    expect(screen.getByText("Status aktiv")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Rückstellung wechseln" }));
    fireEvent.click(screen.getByRole("button", { name: /TEST Lieferant/ }));
    expect(screen.getByText("Status zurückgestellt")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Rückstellung wechseln" }));
    fireEvent.click(screen.getByRole("button", { name: /TEST Lieferant/ }));
    expect(screen.getByText("Status aktiv")).toBeVisible();
  });
  it("entfernt den zurückgestellten Fall unmittelbar aus der Prüfliste", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }));
    render(<PrueflisteAnsicht initialFaelle={[buchung]} konten={[]} kategorien={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Buchungsdetails anzeigen" }));
    fireEvent.click(screen.getByRole("button", { name: "Rückstellung wechseln" }));
    await waitFor(() => expect(screen.queryByText("TEST Lieferant")).not.toBeInTheDocument());
  });
});
