"use client";

/**
 * Berechnet fehlende elektrotechnische Werte aus den vorhandenen über die
 * Standard-Formeln:
 *
 *   - P = U · I               (Wirkleistung; bei AC mit Annahme cos φ ≈ 1,
 *                              für LED-Beleuchtung typisch durch interne PFC)
 *   - Gesamteffizienz η_lm/W = Lichtstrom (lm) / Leistung (W)
 *
 * Quelle der Eingabewerte sind die Form-Inputs (uncontrolled, defaultValue).
 * Die Berechnung liest sie via document.getElementById, schreibt nur in leere
 * Felder, dispatcht ein Input-Event, damit React's onInput-Listener auf der
 * Section den dirty-State setzt.
 *
 * Zellen der Form werden nicht überschrieben — nur leere Felder.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const FIELDS = {
  leistung: "leistung_w",
  strom: "nennstrom_a",
  spannung: "nennspannung_v",
  effizienz: "gesamteffizienz_lm_w",
  lichtstrom: "lichtstrom_lm",
} as const;

function readNumber(id: string): number | null {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return null;
  const raw = el.value.trim().replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function isEmpty(id: string): boolean {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return true;
  return el.value.trim() === "";
}

function setValue(id: string, value: number) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (!el) return;
  // Auf 3 Nachkommastellen runden, trailing-Zeros entfernen
  const rounded = Math.round(value * 1000) / 1000;
  el.value = String(rounded);
  // Input-Event triggert React-onInput auf Section → markDirty
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function ElektrischCalcButton() {
  const [running, setRunning] = useState(false);

  function handleClick(e: React.MouseEvent) {
    // Section-Trigger nicht aus-/einklappen
    e.stopPropagation();
    e.preventDefault();
    setRunning(true);

    const filled: string[] = [];
    const skipped: string[] = [];

    try {
      const P = readNumber(FIELDS.leistung);
      const I = readNumber(FIELDS.strom);
      const U = readNumber(FIELDS.spannung);
      const phi = readNumber(FIELDS.lichtstrom);

      // P = U · I — bei zwei bekannten Werten den dritten ergänzen
      if (P == null && U != null && I != null && U > 0 && I > 0) {
        if (isEmpty(FIELDS.leistung)) {
          setValue(FIELDS.leistung, U * I);
          filled.push(`Leistung = ${(U * I).toFixed(2)} W`);
        }
      } else if (I == null && P != null && U != null && U > 0 && P > 0) {
        if (isEmpty(FIELDS.strom)) {
          setValue(FIELDS.strom, P / U);
          filled.push(`Nennstrom = ${(P / U).toFixed(3)} A`);
        }
      } else if (U == null && P != null && I != null && I > 0 && P > 0) {
        if (isEmpty(FIELDS.spannung)) {
          setValue(FIELDS.spannung, P / I);
          filled.push(`Nennspannung = ${(P / I).toFixed(2)} V`);
        }
      } else if (P != null && U != null && I != null) {
        // Alle drei gefüllt — nichts zu berechnen
      } else {
        skipped.push("P/U/I (mind. 2 Werte nötig)");
      }

      // Effizienz η = Φ / P  — Lichtstrom kommt aus der lichttechnischen Sektion
      // Wir lesen P erneut, falls es gerade berechnet wurde
      const PFinal = readNumber(FIELDS.leistung);
      if (
        isEmpty(FIELDS.effizienz) &&
        phi != null &&
        phi > 0 &&
        PFinal != null &&
        PFinal > 0
      ) {
        const eta = phi / PFinal;
        setValue(FIELDS.effizienz, eta);
        filled.push(`Gesamteffizienz = ${eta.toFixed(1)} lm/W`);
      } else if (isEmpty(FIELDS.effizienz)) {
        if (phi == null) skipped.push("Effizienz (Lichtstrom fehlt)");
        else if (PFinal == null) skipped.push("Effizienz (Leistung fehlt)");
      }

      if (filled.length === 0) {
        toast.info(
          skipped.length > 0
            ? `Nichts zu berechnen — ${skipped.join(", ")}`
            : "Alle berechenbaren Felder sind bereits gefüllt.",
        );
      } else {
        toast.success(`Berechnet: ${filled.join(" · ")}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Berechnung fehlgeschlagen");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={running}
      className="gap-1.5"
      title="Fehlende Felder per P=U·I und η=Φ/P ergänzen"
    >
      {running ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Calculator className="h-3.5 w-3.5" />
      )}
      Fehlende berechnen
    </Button>
  );
}
