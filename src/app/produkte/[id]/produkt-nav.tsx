"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProduktNavProps {
  prevId: string | null;
  nextId: string | null;
  position: number;
  total: number;
  prevLabel?: string | null;
  nextLabel?: string | null;
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function ProduktNav({ prevId, nextId, position, total, prevLabel, nextLabel }: ProduktNavProps) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key === "ArrowLeft" && prevId) {
        e.preventDefault();
        router.push(`/produkte/${prevId}`);
      } else if (e.key === "ArrowRight" && nextId) {
        e.preventDefault();
        router.push(`/produkte/${nextId}`);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevId, nextId, router]);

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        disabled={!prevId}
        onClick={() => prevId && router.push(`/produkte/${prevId}`)}
        title={prevLabel ? `Vorheriges: ${prevLabel} (←)` : "Kein vorheriges Produkt"}
        aria-label="Vorheriges Produkt"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <span className="text-[11px] tabular-nums text-muted-foreground select-none">
        {total > 0 ? `${position}/${total}` : "–"}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={!nextId}
        onClick={() => nextId && router.push(`/produkte/${nextId}`)}
        title={nextLabel ? `Nächstes: ${nextLabel} (→)` : "Kein nächstes Produkt"}
        aria-label="Nächstes Produkt"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
