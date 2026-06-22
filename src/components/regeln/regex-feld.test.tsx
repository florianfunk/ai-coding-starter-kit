// PROJ-15 P1 — Tests für das Regex-Feld mit Live-Validierung + Live-Probe.

import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RegexFeld } from "./regex-feld";
import { MAX_REGEX_LAENGE } from "@/lib/classifier/regex-engine";

function Harness({ initial = "" }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return (
    <RegexFeld id="t" label="Empfänger-Regex" value={v} onChange={setV} />
  );
}

describe("RegexFeld", () => {
  it("zeigt keinen Fehler bei gültigem Muster und zeigt die Live-Probe", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Empfänger-Regex");
    fireEvent.change(input, { target: { value: "^STRIPE\\*.*" } });

    expect(
      screen.queryByText(/wird beim Speichern abgelehnt/i),
    ).not.toBeInTheDocument();

    // Live-Probe erscheint, sobald ein gültiges Muster vorliegt.
    const probe = screen.getByLabelText(/passt auf Beispiel/i);
    fireEvent.change(probe, { target: { value: "STRIPE*ACME" } });
    expect(screen.getByText(/passt$/)).toBeInTheDocument();

    fireEvent.change(probe, { target: { value: "PADDLE" } });
    expect(screen.getByText(/passt nicht/)).toBeInTheDocument();
  });

  it("meldet ein unsicheres (ReDoS) Muster als ungültig", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Empfänger-Regex");
    fireEvent.change(input, { target: { value: "(a+)+" } });
    expect(
      screen.getByText(/Ungültiges oder unsicheres Muster/i),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("erzwingt das 200-Zeichen-Limit sichtbar", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Empfänger-Regex");
    const zuLang = "a".repeat(MAX_REGEX_LAENGE + 1);
    fireEvent.change(input, { target: { value: zuLang } });
    expect(
      screen.getByText(new RegExp(`Höchstens ${MAX_REGEX_LAENGE} Zeichen`)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${zuLang.length}/${MAX_REGEX_LAENGE}`),
    ).toBeInTheDocument();
  });
});
