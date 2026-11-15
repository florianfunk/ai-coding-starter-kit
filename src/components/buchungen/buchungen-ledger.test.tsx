import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Buchung } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
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
  render(<BuchungenLedger buchungen={buchungen} konten={[]} kategorien={[
    { id: "kategorie", bezeichnung: "Kategorie mit 19 %", ust_satz: 19,
      typ: "ausgabe", euer_zeile: null, elster_kennzahl: null, aktiv: true, gueltig_ab: null },
  ]} filter={filter} />);
}

function waehlen(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}

beforeEach(() => {
  // Radix scrollt beim Öffnen zur ausgewählten Option; jsdom hat kein Layout.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(cleanup);

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
