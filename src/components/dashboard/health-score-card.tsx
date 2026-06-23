// PROJ-27 (AC6/AC7): Health-Score-Karte "Stand der Buchhaltung".
//
// Zeigt den 0..100-Score als leichten SVG-Donut + Klartext-Satz + eine
// Komponenten-Aufschlüsselung (Balken je Komponente). Im Leer-Zustand
// (ist_leer / score===null) wird ein Onboarding-Empty-State gerendert.
//
// Server-renderbar — keine Client-Hooks.

import { Sparkles } from "lucide-react";

import type { HealthScore } from "@/lib/dashboard/health-score";
import { formatZahl } from "./format";

// ---------------------------------------------------------------------------
// SVG-Donut: leichter Ring ohne Chart-Lib
// ---------------------------------------------------------------------------

function ScoreDonut({ score }: { score: number }) {
  const groesse = 132;
  const strich = 12;
  const radius = (groesse - strich) / 2;
  const umfang = 2 * Math.PI * radius;
  const anteil = Math.max(0, Math.min(100, score)) / 100;
  const offset = umfang * (1 - anteil);

  // Farbe nach Score-Stufe: der Donut-Strich erbt die Textfarbe der Stufe
  // (stroke="currentColor"), damit er — wie die Text-Klasse — eine Dark-Mode-
  // Variante hat statt fester Hex-Werte (QA-Hinweis PROJ-27).
  const farbKlasse =
    score >= 80
      ? "text-income-strong dark:text-income"
      : score >= 50
        ? "text-highlight-strong dark:text-highlight"
        : "text-destructive";

  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg
        width={groesse}
        height={groesse}
        viewBox={`0 0 ${groesse} ${groesse}`}
        className="-rotate-90"
        role="img"
        aria-label={`Health-Score ${score} von 100`}
      >
        <circle
          cx={groesse / 2}
          cy={groesse / 2}
          r={radius}
          fill="none"
          strokeWidth={strich}
          className="stroke-line-hair"
        />
        <circle
          cx={groesse / 2}
          cy={groesse / 2}
          r={radius}
          fill="none"
          strokeWidth={strich}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={umfang}
          strokeDashoffset={offset}
          className={farbKlasse}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={
            "font-mono text-[34px] font-bold tabular-nums leading-none " +
            farbKlasse
          }
        >
          {formatZahl(score)}
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          von 100
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Komponenten-Balken
// ---------------------------------------------------------------------------

function KomponentenBalken({ erfuellung }: { erfuellung: number }) {
  const breite = Math.max(0, Math.min(100, erfuellung));
  const farbe =
    erfuellung >= 80
      ? "bg-income"
      : erfuellung >= 50
        ? "bg-highlight"
        : "bg-destructive";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-hair">
      <div
        className={"h-full rounded-full " + farbe}
        style={{ width: `${breite}%` }}
        aria-hidden
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hauptkomponente
// ---------------------------------------------------------------------------

export function HealthScoreCard({ data }: { data: HealthScore }) {
  // Empty-/Onboarding-State: keine Buchungen → kein aussagekräftiger Score.
  if (data.ist_leer || data.score === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full bg-tint-cyan text-income-strong"
          aria-hidden
        >
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-[15px] font-semibold">
            Noch keine Daten
          </div>
          <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
            Leg los mit Import &amp; Klassifizierung — dann zeigt dir der
            Score den Stand deiner Buchhaltung.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-6 sm:flex-row sm:items-center">
      {/* Ring + Klartext */}
      <div className="flex items-center gap-5">
        <ScoreDonut score={data.score} />
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--text-subtle)]">
            Stand der Buchhaltung
          </div>
          <p className="mt-1.5 text-[14px] font-medium leading-snug text-foreground">
            {data.klartext}
          </p>
        </div>
      </div>

      {/* Aufschlüsselung */}
      <div className="flex-1 sm:border-l sm:border-line-hair sm:pl-6">
        <ul role="list" className="space-y-2.5">
          {data.komponenten.map((k) => (
            <li key={k.schluessel} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-[12px] text-muted-foreground">
                {k.label}
              </span>
              <span className="min-w-0 flex-1">
                <KomponentenBalken erfuellung={k.erfuellung} />
              </span>
              <span className="w-10 shrink-0 text-right font-mono text-[12px] tabular-nums text-foreground">
                {formatZahl(k.erfuellung)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
