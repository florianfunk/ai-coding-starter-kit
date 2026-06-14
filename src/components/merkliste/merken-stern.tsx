"use client";

// PROJ-20: Merken-Stern — controlled Präsentations-Button. Gefüllt wenn die
// Buchung gemerkt ist. Die eigentliche API-Logik (optimistisch + Rollback)
// liegt in der jeweiligen Container-Ansicht; hier nur Darstellung + onToggle.

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function MerkenStern({
  gemerkt,
  onToggle,
  pending = false,
  size = "md",
  className,
}: {
  gemerkt: boolean;
  onToggle: () => void;
  /** Sperrt den Button während der API-Aktion. */
  pending?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <button
      type="button"
      onClick={(e) => {
        // In klickbaren Zeilen: nicht die Detail-Ansicht mit öffnen.
        e.stopPropagation();
        if (!pending) onToggle();
      }}
      disabled={pending}
      aria-pressed={gemerkt}
      aria-label={gemerkt ? "Von Merkliste entfernen" : "Auf Merkliste setzen"}
      title={gemerkt ? "Von Merkliste entfernen" : "Merken"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors",
        box,
        gemerkt
          ? "text-highlight-strong hover:bg-[color:var(--surface-2)]"
          : "text-muted-foreground hover:bg-[color:var(--surface-2)] hover:text-highlight-strong",
        pending && "opacity-50",
        className,
      )}
    >
      <Star className={cn(icon, gemerkt && "fill-current")} />
    </button>
  );
}
