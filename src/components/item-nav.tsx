"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ItemNavProps {
  /** Pfad-Prefix, an den die ID angehängt wird (z. B. "/produkte"). */
  basePath: string;
  prevId: string | null;
  nextId: string | null;
  position: number;
  total: number;
  prevLabel?: string | null;
  nextLabel?: string | null;
  /** Substantiv für Tooltips, z. B. "Produkt", "Bereich", "Kategorie". */
  itemNoun?: string;
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function ItemNav({
  basePath,
  prevId,
  nextId,
  position,
  total,
  prevLabel,
  nextLabel,
  itemNoun = "Eintrag",
}: ItemNavProps) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key === "ArrowLeft" && prevId) {
        e.preventDefault();
        router.push(`${basePath}/${prevId}`);
      } else if (e.key === "ArrowRight" && nextId) {
        e.preventDefault();
        router.push(`${basePath}/${nextId}`);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevId, nextId, router, basePath]);

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        disabled={!prevId}
        onClick={() => prevId && router.push(`${basePath}/${prevId}`)}
        title={prevLabel ? `Vorherige(r/s) ${itemNoun}: ${prevLabel} (←)` : `Kein(e) vorherige(r/s) ${itemNoun}`}
        aria-label={`Vorherige(r/s) ${itemNoun}`}
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
        onClick={() => nextId && router.push(`${basePath}/${nextId}`)}
        title={nextLabel ? `Nächste(r/s) ${itemNoun}: ${nextLabel} (→)` : `Kein(e) nächste(r/s) ${itemNoun}`}
        aria-label={`Nächste(r/s) ${itemNoun}`}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
