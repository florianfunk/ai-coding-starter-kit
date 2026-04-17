"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FieldInfo({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Feld-Info"
          onClick={(e) => e.preventDefault()}
        >
          <Info className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
