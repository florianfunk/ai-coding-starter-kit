"use client";

// PROJ-6: Nachvollziehbarkeit — zeigt den Match-Score-Breakdown je Kriterium.

import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ScoreBreakdown } from "@/lib/matching/score";

const LABEL: Record<keyof ScoreBreakdown, string> = {
  betrag: "Betrag",
  datum: "Datum",
  empfaenger: "Empfänger",
  text: "Text",
};

export function KriterienDetail({
  score,
  kriterien,
}: {
  score: number | null;
  kriterien: ScoreBreakdown | null;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2">
          <Badge variant={score !== null && score >= 0.85 ? "default" : "secondary"}>
            {score !== null ? `${Math.round(score * 100)} %` : "–"}
          </Badge>
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <p className="mb-2 text-sm font-medium">Match-Begründung</p>
        {kriterien ? (
          <ul className="space-y-2 text-sm">
            {(Object.keys(LABEL) as Array<keyof ScoreBreakdown>).map((key) => {
              const k = kriterien[key];
              return (
                <li key={key} className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground">
                    {LABEL[key]}
                    <span className="ml-1 text-xs">
                      (×{k.gewicht.toFixed(2)})
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="font-medium">
                      {Math.round(k.score * 100)} %
                    </span>
                    <br />
                    <span className="text-xs text-muted-foreground">
                      {k.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Keine Detailbegründung vorhanden.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
