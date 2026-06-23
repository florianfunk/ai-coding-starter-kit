// PROJ-27 (AC6/AC7): Aktivitäts-Feed "Was ist passiert?".
//
// Rendert die jüngsten Aktivitäten als Timeline-Zeilen (Icon je Art +
// Titel + relativer Zeitstempel). Leere Liste → Empty-State.
//
// Server-renderbar — keine Client-Hooks.

import {
  CheckCircle2,
  Dot,
  RefreshCw,
  Tag,
  Upload,
} from "lucide-react";

import type {
  AktivitaetsArt,
  AktivitaetsEintrag,
} from "@/lib/dashboard/aktivitaet";
import { formatRelativeZeit } from "./format";

/** Icon + Farbton je Aktivitäts-Art. */
function artDarstellung(art: AktivitaetsArt): {
  icon: React.ReactNode;
  ton: string;
} {
  switch (art) {
    case "klassifizierung":
      return {
        icon: <Tag className="h-3.5 w-3.5" />,
        ton: "bg-tint-violet text-brand-violet",
      };
    case "sync":
      return {
        icon: <RefreshCw className="h-3.5 w-3.5" />,
        ton: "bg-tint-cyan text-income-strong",
      };
    case "import":
      return {
        icon: <Upload className="h-3.5 w-3.5" />,
        ton: "bg-tint-yellow text-highlight-strong",
      };
    case "abschluss":
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        ton: "bg-tint-cyan text-income-strong",
      };
    case "sonstiges":
    default:
      return {
        icon: <Dot className="h-3.5 w-3.5" />,
        ton: "bg-[color:var(--surface-2)] text-muted-foreground",
      };
  }
}

export function AktivitaetFeed({
  eintraege,
}: {
  eintraege: AktivitaetsEintrag[];
}) {
  if (eintraege.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-[13px] text-muted-foreground">
        Noch keine Aktivität — sobald importiert, synchronisiert oder
        klassifiziert wird, erscheint es hier.
      </div>
    );
  }

  return (
    <ul role="list" className="divide-y divide-line-hair">
      {eintraege.map((e) => {
        const d = artDarstellung(e.art);
        return (
          <li key={e.id} className="flex items-center gap-3 px-5 py-3">
            <span
              className={
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full " +
                d.ton
              }
              aria-hidden
            >
              {d.icon}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
              {e.titel}
            </span>
            <time
              dateTime={e.zeitpunkt}
              className="shrink-0 font-mono text-[12px] tabular-nums text-muted-foreground"
            >
              {formatRelativeZeit(e.zeitpunkt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
