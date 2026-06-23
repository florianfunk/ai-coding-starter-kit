// PROJ-27 (AC6/AC7): USt-VA-Fristen-Countdown.
//
// Zeigt prominent, wann die nächste USt-VA-Frist fällig ist — mit Ampel-
// Farbe (neutral/gelb/rot) und Klick zur USt-VA. Bei `fristen===null`
// (keine offene Frist) wird ein dezenter Ruhe-Zustand gerendert.
//
// Server-renderbar — keine Client-Hooks.

import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";

import type { UstFristInfo } from "@/lib/dashboard/fristen";
import { formatDatum, formatZahl } from "./format";

/** Ampel → Hintergrund/Text/Akzent (gleiche Tokens wie restliche Blöcke). */
function ampelKlassen(ampel: UstFristInfo["ampel"]): {
  icon: string;
  countdown: string;
} {
  switch (ampel) {
    case "rot":
      return {
        icon: "bg-tint-cerise text-destructive",
        countdown: "text-destructive",
      };
    case "gelb":
      return {
        icon: "bg-tint-yellow text-highlight-strong",
        countdown: "text-highlight-strong",
      };
    case "neutral":
    default:
      return {
        icon: "bg-tint-cyan text-income-strong",
        countdown: "text-foreground",
      };
  }
}

export function FristenCountdown({ fristen }: { fristen: UstFristInfo | null }) {
  // Ruhe-Zustand: keine offene Frist.
  if (!fristen) {
    return (
      <div className="flex h-full items-center gap-3 px-5 py-5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[color:var(--surface-2)] text-muted-foreground"
          aria-hidden
        >
          <CalendarClock className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--text-subtle)]">
            USt-VA-Frist
          </div>
          <div className="mt-0.5 text-[14px] font-medium text-muted-foreground">
            Keine offene USt-VA-Frist
          </div>
        </div>
      </div>
    );
  }

  const { periode, abgabefrist, tage_bis_frist, ueberfaellig, ampel } = fristen;
  const klassen = ampelKlassen(ampel);

  const countdownText = ueberfaellig
    ? `seit ${formatZahl(Math.abs(tage_bis_frist))} ${
        Math.abs(tage_bis_frist) === 1 ? "Tag" : "Tagen"
      } überfällig`
    : tage_bis_frist === 0
      ? "heute fällig"
      : `fällig in ${formatZahl(tage_bis_frist)} ${
          tage_bis_frist === 1 ? "Tag" : "Tagen"
        }`;

  return (
    <Link
      href={`/ust-voranmeldung?jahr=${periode.jahr}`}
      className="flex h-full items-center gap-3 px-5 py-5 transition-colors hover:bg-[color:var(--surface-2)]"
    >
      <div
        className={
          "flex h-9 w-9 items-center justify-center rounded-[10px] " +
          klassen.icon
        }
        aria-hidden
      >
        <CalendarClock className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[color:var(--text-subtle)]">
          USt-VA {periode.label}
        </div>
        <div
          className={"mt-0.5 text-[15px] font-semibold leading-tight " + klassen.countdown}
        >
          {countdownText}
        </div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">
          Abgabefrist {formatDatum(abgabefrist)}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-line-strong" />
    </Link>
  );
}
