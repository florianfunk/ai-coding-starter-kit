// PROJ-30 (AC4–AC6): Mini-Linienchart (Sparkline) + Δ-Indikator für die
// Snapshot-KPIs des Dashboards.
//
// Bewusst minimalistisch: eine einzelne Linie ohne Achsen, Grid, Tooltip oder
// Legende — reiner Überblick über den Verlauf der 12 WJ-Monate, KEIN
// interaktives Analyse-Chart.
//
// Dark-Mode-konsistent über `currentColor`: der Wrapper trägt die passende
// text-Farbklasse (wie der Health-Score-Donut), die recharts-Linie erbt sie via
// stroke="currentColor". Keine festen Hex-Werte.
//
// "use client", weil recharts im Browser rendert.

"use client";

import * as React from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

import type { MonatsPunkt } from "@/lib/dashboard/trend";
import { letzterUndVormonat } from "@/lib/dashboard/trend";
import { formatEuro } from "./format";

// ---------------------------------------------------------------------------
// prefers-reduced-motion (AC6): clientseitig auswerten, SSR-sicher.
// ---------------------------------------------------------------------------

function usePrefersReducedMotion(): boolean {
  const [reduziert, setReduziert] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduziert(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduziert(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduziert;
}

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

type Feld = "einnahmen" | "ausgaben" | "ust_zahllast";
type Tone = "income" | "expense";

const FELD_NAME: Record<Feld, string> = {
  einnahmen: "Einnahmen",
  ausgaben: "Ausgaben",
  ust_zahllast: "USt-Zahllast",
};

// tone → Tailwind-Textfarbe; die Linie erbt sie via currentColor (dark-mode-fest).
const TONE_TEXT: Record<Tone, string> = {
  income: "text-income-strong dark:text-income",
  expense: "text-destructive",
};

// ---------------------------------------------------------------------------
// Δ-Indikator
// ---------------------------------------------------------------------------
//
// Farbregel (bewusst schlicht, AC4): Die Pfeil-RICHTUNG folgt immer dem
// Vorzeichen von Δ (steigt/fällt/gleich). Die FARBE folgt dem tone der Kennzahl
// — income=cyan, expense=cerise — aber NUR wenn sich überhaupt etwas bewegt.
// Wir bewerten also nicht "gut/schlecht" (steigende Ausgaben sind nicht per se
// rot-warnend), sondern färben dezent passend zur jeweiligen KPI. Bei Δ = 0
// bzw. fehlenden Daten bleibt der Indikator neutral (muted).

function DeltaIndikator({
  delta,
  hatDaten,
  tone,
}: {
  delta: number;
  hatDaten: boolean;
  tone: Tone;
}) {
  const gerundet = Math.round(delta * 100) / 100;
  const richtung = !hatDaten || gerundet === 0 ? 0 : gerundet > 0 ? 1 : -1;

  const pfeil = richtung > 0 ? "▲" : richtung < 0 ? "▼" : "–";
  const farbe = richtung === 0 ? "text-muted-foreground" : TONE_TEXT[tone];

  const betrag = hatDaten ? formatEuro(Math.abs(gerundet)) : "—";
  const vorzeichen = richtung > 0 ? "+" : richtung < 0 ? "−" : "";

  return (
    <div
      className={"flex items-center gap-1 text-[11px] tabular-nums " + farbe}
      aria-label={
        hatDaten
          ? `Veränderung zum Vormonat ${vorzeichen}${formatEuro(Math.abs(gerundet))}`
          : "Keine Vormonatsveränderung"
      }
    >
      <span aria-hidden className="text-[9px] leading-none">
        {pfeil}
      </span>
      <span>
        {vorzeichen}
        {betrag}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

export function KpiSparkline({
  punkte,
  feld,
  tone,
}: {
  punkte: MonatsPunkt[] | undefined | null;
  feld: Feld;
  tone: Tone;
}) {
  const reduzierteBewegung = usePrefersReducedMotion();

  const reihe = punkte ?? [];

  // Daten in das Format für recharts bringen (nur das relevante Feld).
  const daten = reihe.map((p) => ({ label: p.label, wert: p[feld] }));

  // AC5: Verlauf nur sinnvoll bei >= 2 nicht-null Punkten. Sonst flat/leer.
  const nichtNull = daten.filter((d) => d.wert !== 0).length;
  const hatVerlauf = nichtNull >= 2;

  // Δ zum Vormonat (AC4) — Backend-Helfer wiederverwenden.
  // Den Δ-Indikator nur zeigen, wenn auch ein Verlauf existiert (≥2 Datenpunkte).
  // Sonst entstünde der inkonsistente Grenzfall "Δ ohne Linie" (QA-Hinweis):
  // bei genau 1 Monat Daten wäre der Vormonat ein leerer 0-Bucket → irreführend.
  const delta = letzterUndVormonat(reihe);
  const paar = delta[feld];
  const hatDelta = hatVerlauf && delta.aktuellerIndex >= 0;
  const deltaWert = paar.aktuell - paar.vormonat;

  return (
    <div className="mt-3 border-t border-line-hair pt-2.5">
      <div className="flex items-end justify-between gap-3">
        {/* Mini-Chart bzw. Empty-Hinweis */}
        <div className={"h-9 min-w-0 flex-1 " + TONE_TEXT[tone]}>
          {hatVerlauf ? (
            <ResponsiveContainer width="100%" height={36}>
              <LineChart
                data={daten}
                margin={{ top: 4, right: 2, bottom: 4, left: 2 }}
                role="img"
                aria-label={`Verlauf ${FELD_NAME[feld]}, ${reihe.length} Monate`}
              >
                <Line
                  type="monotone"
                  dataKey="wert"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  dot={false}
                  isAnimationActive={!reduzierteBewegung}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div
              className="flex h-9 items-center text-[11px] text-muted-foreground"
              aria-label={`Verlauf ${FELD_NAME[feld]}: noch kein Verlauf`}
            >
              Noch kein Verlauf
            </div>
          )}
        </div>

        {/* Δ zum Vormonat */}
        <DeltaIndikator delta={deltaWert} hatDaten={hatDelta} tone={tone} />
      </div>
    </div>
  );
}
