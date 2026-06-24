// PROJ-31 (AC4–AC6): Dezente Vorjahresvergleichs-Zeile (YoY) unter einem
// Snapshot-StatBlock.
//
// Stil: Haarlinie + kleine Editorial-Zeile. Konsistent zur PROJ-30-
// DeltaIndikator-Regel:
//   - Pfeil ▲/▼/– folgt IMMER dem Vorzeichen von Δ (steigt/fällt/gleich).
//   - Farbe folgt dem `tone` der Kennzahl (income/expense) — NICHT
//     gut/schlecht-wertend; bei Δ = 0 / keine Daten neutral (muted).
// Dark-mode-fest über Tone-Klassen (currentColor-Prinzip), KEINE festen Hex.
//
// Reine Anzeigekomponente (server-renderbar): keine Daten-Fetches.

import type { YoyDelta } from "@/lib/dashboard/yoy";
import { formatEuro } from "./format";

type Tone = "income" | "expense";

// tone → Tailwind-Textfarbe (dark-mode-fest), identisch zur Sparkline-Regel.
const TONE_TEXT: Record<Tone, string> = {
  income: "text-income-strong dark:text-income",
  expense: "text-destructive",
};

/** Prozent-Δ deutsch formatiert, oder null-Marker. */
function formatProzent(delta: YoyDelta): string | null {
  if (delta.prozent === null) return null;
  const vz = delta.prozent > 0 ? "+" : delta.prozent < 0 ? "−" : "";
  const betrag = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Math.abs(delta.prozent));
  return `${vz}${betrag} %`;
}

/**
 * YoY-Zeile: "Vorjahr X € · ▲ +Y %" bzw. "neu" bei Vorjahr 0.
 *
 * @param vorjahrWert Vorjahreswert dieser KPI (cent-gerundet).
 * @param delta       Δ-Helfer aus berechneYoy (absolut/prozent/ist_neu).
 * @param tone        Farb-Tone der KPI (income/expense).
 * @param ist_ytd     true → Vorjahr ist YTD-begrenzt; "YTD"-Marker zeigen.
 * @param label       KPI-Name für aria (z. B. "Betriebseinnahmen").
 */
export function KpiYoy({
  vorjahrWert,
  delta,
  tone,
  ist_ytd,
  label,
}: {
  vorjahrWert: number;
  delta: YoyDelta;
  tone: Tone;
  ist_ytd: boolean;
  label: string;
}) {
  const gerundet = Math.round(delta.absolut * 100) / 100;
  const richtung = gerundet === 0 ? 0 : gerundet > 0 ? 1 : -1;
  const pfeil = richtung > 0 ? "▲" : richtung < 0 ? "▼" : "–";
  const farbe = richtung === 0 ? "text-muted-foreground" : TONE_TEXT[tone];

  const prozentText = formatProzent(delta);
  // Anzeigetext der Veränderung: Prozent bevorzugt, sonst "neu" (Vorjahr 0 mit
  // Wert) bzw. "—" (Vorjahr 0 ohne Wert).
  const aenderungText = prozentText ?? (delta.ist_neu ? "neu" : "—");

  const ariaRichtung =
    richtung > 0 ? "gestiegen" : richtung < 0 ? "gefallen" : "unverändert";
  const ariaLabel = delta.ist_neu
    ? `${label}: kein Vorjahreswert, ${formatEuro(Math.abs(gerundet))} neu`
    : `${label} gegenüber Vorjahr ${ariaRichtung} um ${formatEuro(
        Math.abs(gerundet),
      )}${prozentText ? `, ${prozentText.replace("−", "minus ").replace("+", "plus ")}` : ""}${
        ist_ytd ? " (Jahr bis heute)" : ""
      }`;

  return (
    <div
      className="mt-2 border-t border-line-hair pt-2 text-[11px] text-muted-foreground"
      aria-label={ariaLabel}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="tabular-nums">
          Vorjahr {formatEuro(vorjahrWert)}
          {ist_ytd ? (
            <span
              className="ml-1 rounded-sm bg-[color:var(--surface-2)] px-1 py-px text-[9px] uppercase tracking-wide text-muted-foreground"
              title="Vorjahr auf denselben Zeitraum (Jahr bis heute) begrenzt"
            >
              YTD
            </span>
          ) : null}
        </span>
        <span
          className={"flex items-center gap-1 tabular-nums " + farbe}
          aria-hidden
        >
          <span className="text-[9px] leading-none">{pfeil}</span>
          <span>{aenderungText}</span>
        </span>
      </div>
    </div>
  );
}
