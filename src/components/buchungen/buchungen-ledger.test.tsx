import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Buchung } from "@/lib/types";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/buchungen/buchung-detail-sheet", () => ({
  BuchungDetailSheet: () => null,
}));

import { BuchungenLedger } from "./buchungen-ledger";

function buchung(id: string, ust_satz: number | null, overrides: Partial<Buchung> = {}): Buchung {
  return {
    id, ust_satz, konto_id: "konto", buchung_datum: "2026-10-01",
    betrag: -100, empfaenger: id, verwendungszweck: "Rechnung", waehrung: "EUR",
    klassifikation: "geschaeftlich", steuerrelevant: true, steuer_zurueckgestellt: false,
    kategorie_id: "kategorie", begruendung: null, konfidenz: null, quelle: "manuell",
    status: "manuell_bestaetigt", pruef_grund: null, parent_buchung_id: null,
    split_anteil: null, gemerkt_am: null, ...overrides,
  };
}

const buchungen = [
  buchung("Regelsatz", 19),
  buchung("Ermäßigt", 7),
  buchung("Nullsatz", 0),
  buchung("Fehlender Satz", null),
  buchung("Anderer Satz", 16),
  buchung("Privat ohne Satz", null, { klassifikation: "privat" }),
  buchung("Zurückgestellt ohne Satz", null, { steuer_zurueckgestellt: true }),
];

function anzeigen(filter: { steuerstatus?: "zurueckgestellt" } = {}) {
  return render(<BuchungenLedger buchungen={buchungen} konten={[]} kategorien={[
    { id: "kategorie", bezeichnung: "Kategorie mit 19 %", ust_satz: 19,
      typ: "ausgabe", euer_zeile: null, elster_kennzahl: null, aktiv: true, gueltig_ab: null },
  ]} filter={filter} />);
}

function waehlen(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Radix scrollt beim Öffnen zur ausgewählten Option; jsdom hat kein Layout.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Steuersatzfilter im Buchungsledger", () => {
  it("zeigt 0 %, fehlende und andere Sätze anhand der Buchung statt der Kategorie", () => {
    anzeigen();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    waehlen("Steuersatz", "Weder 19 % noch 7 %");

    expect(screen.queryByText("Regelsatz")).not.toBeInTheDocument();
    expect(screen.queryByText("Ermäßigt")).not.toBeInTheDocument();
    for (const name of ["Nullsatz", "Fehlender Satz", "Anderer Satz", "Privat ohne Satz", "Zurückgestellt ohne Satz"]) {
      expect(screen.getByText(name)).toBeVisible();
    }
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Einträge").nextElementSibling).toHaveTextContent("5");
    expect(screen.getByText("Ausgaben").nextElementSibling?.textContent).toMatch(/-500,00\s*€/);
  });

  it("kombiniert den Steuersatz mit Klassifikation, Steuerstatus und Suche und setzt ihn zurück", () => {
    anzeigen();
    waehlen("Steuersatz", "Weder 19 % noch 7 %");
    waehlen("Klassifikation", "Geschäftlich");
    waehlen("Steuerstatus", "Nicht zurückgestellt");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Privat ohne Satz")).not.toBeInTheDocument();
    expect(screen.queryByText("Zurückgestellt ohne Satz")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buchungen durchsuchen/), { target: { value: "Fehlender" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Fehlender Satz")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Filter zurücksetzen" }));
    expect(screen.getByRole("combobox", { name: "Steuersatz" })).toHaveTextContent("Alle Steuersätze");
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });

  it("bleibt in der Ansicht zurückgestellter Buchungen nutzbar und lässt sich abwählen", () => {
    anzeigen({ steuerstatus: "zurueckgestellt" });
    expect(screen.getByRole("combobox", { name: "Steuerstatus" })).toBeDisabled();
    waehlen("Steuersatz", "Weder 19 % noch 7 %");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Zurückgestellt ohne Satz")).toBeVisible();
    waehlen("Steuersatz", "Alle Steuersätze");
    expect(screen.getByRole("combobox", { name: "Steuersatz" })).toHaveTextContent("Alle Steuersätze");
  });
});

describe("Steuersatz-Sammeländerung im Buchungsledger", () => {
  it("ändert nur die sichtbare Auswahl, auch wenn vor dem Filtern alle markiert waren", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      aktualisiert: 5, uebersprungen: [], ust_satz: 19,
    }) });
    vi.stubGlobal("fetch", fetchMock);
    const ansicht = anzeigen();
    expect(screen.getByRole("button", { name: "Steuersatz ändern" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Alle sichtbaren Buchungen auswählen" }));
    waehlen("Steuersatz", "Weder 19 % noch 7 %");
    expect(screen.getByText("5 ausgewählt")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Steuersatz ändern" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Für 5 ausgewählte Buchungen");
    waehlen("Neuer Steuersatz", "19 %");
    fireEvent.click(screen.getByRole("button", { name: "Steuersatz speichern" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      ids: buchungen.filter((b) => b.ust_satz !== 19 && b.ust_satz !== 7).map((b) => b.id),
      ust_satz: 19,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Steuersatz ändern" })).toBeDisabled();
    ansicht.rerender(<BuchungenLedger
      buchungen={buchungen.map((b) => ({ ...b, ust_satz: b.ust_satz === 7 ? 7 : 19 }))}
      konten={[]} kategorien={[]} filter={{}}
    />);
    expect(screen.getByText("Keine Treffer")).toBeVisible();
    expect(screen.getByText("Einträge").nextElementSibling).toHaveTextContent("0");
  });
});
