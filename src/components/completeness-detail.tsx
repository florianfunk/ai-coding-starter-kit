"use client";

import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  completenessBarClass,
  completenessTextClass,
  type CompletenessResult,
} from "@/lib/completeness";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";

type Props = {
  result: CompletenessResult;
  className?: string;
};

/** Field-to-section mapping for scroll links */
const FIELD_ANCHORS: Record<string, string> = {
  Artikelnummer: "field-artikelnummer",
  Name: "field-name",
  Kategorie: "field-kategorie",
  Hauptbild: "field-hauptbild",
  "Aktiver Preis": "section-preise",
  Datenblatttitel: "field-datenblatt_titel",
  Datenblatttext: "field-datenblatt_text",
  "Datenblatt-Vorlage": "section-datenblatt",
  "Technische Daten": "section-technisch",
  Abmessungen: "section-mechanisch",
  "Galerie-Bild": "section-galerie",
  "Icon zugeordnet": "field-icons",
};

const ALL_FIELDS = [
  "Artikelnummer",
  "Name",
  "Kategorie",
  "Hauptbild",
  "Aktiver Preis",
  "Datenblatttitel",
  "Datenblatttext",
  "Datenblatt-Vorlage",
  "Technische Daten",
  "Abmessungen",
  "Galerie-Bild",
  "Icon zugeordnet",
];

export function CompletenessDetail({ result, className }: Props) {
  const barColor = completenessBarClass(result.color);
  const textColor = completenessTextClass(result.color);
  const missingSet = new Set(result.missing);

  function scrollTo(anchor: string) {
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "ring-offset-2");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2000);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2.5 rounded-lg border px-3 py-1.5 hover:bg-muted/50 transition-colors cursor-pointer",
            className,
          )}
        >
          <span className="text-xs text-muted-foreground hidden sm:inline">Vollständigkeit</span>
          <Progress
            value={result.percent}
            className="h-2 w-16 bg-muted"
            indicatorClassName={barColor}
          />
          <span className={cn("text-sm font-bold tabular-nums", textColor)}>
            {result.percent}%
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Vollständigkeit
          </p>
          <span className={cn("text-lg font-bold tabular-nums", textColor)}>
            {result.percent}%
          </span>
        </div>
        <Progress
          value={result.percent}
          className="h-2.5 bg-muted"
          indicatorClassName={barColor}
        />
        <ul className="space-y-1 pt-1">
          {ALL_FIELDS.map((field) => {
            const isMissing = missingSet.has(field);
            const anchor = FIELD_ANCHORS[field];
            return (
              <li key={field} className="flex items-center gap-2 text-sm">
                {isMissing ? (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                )}
                {isMissing && anchor ? (
                  <button
                    type="button"
                    onClick={() => scrollTo(anchor)}
                    className="text-left text-muted-foreground hover:text-primary hover:underline transition-colors"
                  >
                    {field}
                  </button>
                ) : (
                  <span className={isMissing ? "text-muted-foreground" : ""}>{field}</span>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
