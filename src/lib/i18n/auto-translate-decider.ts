/**
 * PROJ-46 — Reine Entscheidungs-Funktion für die Auto-Übersetzung.
 *
 * Vergleicht Vorher- und Nachher-Werte der DE/IT-Spaltenpaare und liefert die
 * Liste der DE-Schlüssel zurück, die der Translator neu übersetzen soll.
 *
 * Regeln:
 *   1. DE unverändert  → Feld überspringen (keine Re-Übersetzung nötig).
 *   2. DE geändert + IT in **diesem** Save manuell editiert (newIt ≠ oldIt)
 *      → Feld überspringen (manueller Wert gewinnt).
 *   3. DE geändert + IT unverändert (newIt === oldIt — die Form hat das
 *      hidden Input nur durchgeschleift) → übersetzen.
 *
 * Pure Funktion — keine DB-Reads, keine Side-Effects — damit per Vitest
 * regressionsicher.
 */
import { TRANSLATABLE_FIELDS } from "./translatable-fields";

export interface AutoTranslateInputs {
  /** Vorher-Snapshot der `produkte`-Row (DE und IT Spalten). */
  vorher: Record<string, unknown>;
  /** Geparste Eingabe aus dem Formular (DE und IT Spalten). */
  parsedData: Record<string, unknown>;
}

/** Liefert die DE-Schlüssel, deren Übersetzung neu generiert werden soll. */
export function decideAutoTranslateKeys(inputs: AutoTranslateInputs): string[] {
  const out: string[] = [];
  for (const f of TRANSLATABLE_FIELDS) {
    const oldDe = String(inputs.vorher[f.de] ?? "").trim();
    const newDe = String((inputs.parsedData[f.de] as string | null | undefined) ?? "").trim();
    if (oldDe === newDe) continue;
    const oldIt = String(inputs.vorher[f.it] ?? "").trim();
    const newIt = String((inputs.parsedData[f.it] as string | null | undefined) ?? "").trim();
    if (newIt !== oldIt) continue;
    out.push(f.de);
  }
  return out;
}
