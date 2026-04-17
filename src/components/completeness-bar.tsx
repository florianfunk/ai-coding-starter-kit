"use client";

import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  completenessBarClass,
  completenessTextClass,
  type CompletenessResult,
} from "@/lib/completeness";
import { cn } from "@/lib/utils";

type Props = {
  result: CompletenessResult;
  /** Show the percent number next to the bar (default true) */
  showPercent?: boolean;
  className?: string;
};

export function CompletenessBar({ result, showPercent = true, className }: Props) {
  const barColor = completenessBarClass(result.color);
  const textColor = completenessTextClass(result.color);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2 min-w-[120px]", className)}>
            <Progress
              value={result.percent}
              className="h-2 flex-1 bg-muted"
              indicatorClassName={barColor}
            />
            {showPercent && (
              <span className={cn("text-xs font-semibold tabular-nums w-8 text-right", textColor)}>
                {result.percent}%
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {result.missing.length === 0 ? (
            <p className="text-sm">Alle Felder ausgefuellt</p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">
                Fehlende Felder:
              </p>
              <ul className="text-sm space-y-0.5">
                {result.missing.map((m) => (
                  <li key={m} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
