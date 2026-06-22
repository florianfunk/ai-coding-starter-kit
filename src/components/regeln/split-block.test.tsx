// PROJ-15 P1 — Tests für den Split-Block (Live-Vorschau der Anteile + Beträge).

import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SplitBlock, type SplitBlockValues } from "./split-block";

// Radix Slider nutzt ResizeObserver, das jsdom nicht kennt — lokaler Stub.
beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const VALUES: SplitBlockValues = {
  anteilGeschaeftlichProzent: 60,
  kategorieGeschaeftlich: "none",
  kategoriePrivat: "none",
  ustSatzGeschaeftlich: "none",
};

describe("SplitBlock", () => {
  it("blendet die Felder aus, solange der Split deaktiviert ist", () => {
    render(
      <SplitBlock
        aktiv={false}
        onAktivChange={() => {}}
        values={VALUES}
        onChange={() => {}}
        kategorien={[]}
      />,
    );
    expect(
      screen.queryByLabelText("Geschäftlicher Anteil in Prozent"),
    ).not.toBeInTheDocument();
  });

  it("zeigt die prozentuale Live-Vorschau (Rest = privat)", () => {
    render(
      <SplitBlock
        aktiv
        onAktivChange={() => {}}
        values={VALUES}
        onChange={() => {}}
        kategorien={[]}
      />,
    );
    // „60 %" steht sowohl am Slider als auch in der Vorschau.
    expect(screen.getAllByText("60 %").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("40 %")).toBeInTheDocument();
  });

  it("rechnet bei einem Beispielbetrag die Anteile in Euro um", () => {
    render(
      <SplitBlock
        aktiv
        onAktivChange={() => {}}
        values={VALUES}
        onChange={() => {}}
        kategorien={[]}
        beispielBetrag={60}
      />,
    );
    // 60 % von 60 € = 36,00 €; 40 % = 24,00 €
    expect(screen.getByText(/36,00\s*€/)).toBeInTheDocument();
    expect(screen.getByText(/24,00\s*€/)).toBeInTheDocument();
  });

  it("ruft onAktivChange über den Schalter auf", () => {
    const onAktiv = vi.fn();
    render(
      <SplitBlock
        aktiv={false}
        onAktivChange={onAktiv}
        values={VALUES}
        onChange={() => {}}
        kategorien={[]}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Split aktivieren" }));
    expect(onAktiv).toHaveBeenCalledWith(true);
  });
});
