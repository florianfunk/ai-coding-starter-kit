"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckState } from "./use-tree-selection";

type Props = {
  state: CheckState;
  onToggle: () => void;
  ariaLabel: string;
  className?: string;
};

export function TriStateCheckbox({ state, onToggle, ariaLabel, className }: Props) {
  const checked: boolean | "indeterminate" =
    state === "checked" ? true : state === "indeterminate" ? "indeterminate" : false;

  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={onToggle}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary",
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        className,
      )}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
        {state === "indeterminate" ? <Minus className="h-3 w-3" /> : <Check className="h-3.5 w-3.5" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
