"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Maximize2, Scissors, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { enhanceBild } from "@/app/einstellungen/ai-actions";
import { cn } from "@/lib/utils";

type Operation = "upscale" | "remove-bg";
type Bucket = "produktbilder" | "assets";

type Props = {
  bucket: Bucket;
  path: string;
  disabled?: boolean;
  /**
   * Wird mit dem neuen Storage-Pfad aufgerufen, nachdem Replicate fertig ist
   * und das Ergebnis ins Bucket hochgeladen wurde. Der Aufrufer muss den
   * neuen Pfad in der jeweiligen DB-Spalte persistieren. Wenn der Callback
   * wirft, wird die Erfolgs-Toast-Nachricht unterdrückt.
   */
  onReplaced: (newPath: string) => void | Promise<void>;
  /**
   * Wenn true, löscht enhanceBild() das Original aus dem Storage nach
   * erfolgreichem Upload des Ergebnisses. Default: false — nur setzen,
   * wenn onReplaced sofort in die DB schreibt.
   */
  deleteOriginal?: boolean;
  /** Kleineres Layout für Bildgalerie-Overlays. Default: normal. */
  size?: "sm" | "icon";
  /** Zusätzliche Klasse für den Trigger-Button. */
  className?: string;
};

const OP_META: Record<Operation, { label: string; title: string; description: string; icon: typeof Maximize2 }> = {
  "upscale": {
    label: "Hochskalieren (2×)",
    title: "Bild hochskalieren?",
    description: "Das Bild wird durch Replicate (Clarity-Upscaler) auf die doppelte Auflösung gebracht und ersetzt das Original. Kosten: ca. $0.012 pro Bild. Dauer: ca. 10–15 Sekunden.",
    icon: Maximize2,
  },
  "remove-bg": {
    label: "Hintergrund entfernen",
    title: "Hintergrund entfernen?",
    description: "Der Hintergrund wird durch Replicate (BRIA RMBG-2.0) freigestellt und als PNG mit Transparenz gespeichert. Das Original wird ersetzt. Kosten: ca. $0.04 pro Bild. Dauer: ca. 3 Sekunden.",
    icon: Scissors,
  },
};

export function EnhanceBildButton({
  bucket,
  path,
  disabled,
  onReplaced,
  deleteOriginal = false,
  size,
  className,
}: Props) {
  const [pendingOp, setPendingOp] = useState<Operation | null>(null);
  const [confirmOp, setConfirmOp] = useState<Operation | null>(null);
  const [, startTransition] = useTransition();

  const isIcon = size === "icon";
  const running = pendingOp !== null;

  function runOperation(op: Operation) {
    setPendingOp(op);
    startTransition(async () => {
      const r = await enhanceBild({ bucket, path, operation: op, deleteOriginal });
      if (!r.ok) {
        toast.error(r.error || "Bildbearbeitung fehlgeschlagen");
        setPendingOp(null);
        return;
      }
      try {
        await onReplaced(r.path);
        toast.success(op === "upscale" ? "Bild hochskaliert" : "Hintergrund entfernt");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
      } finally {
        setPendingOp(null);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={isIcon ? "secondary" : "outline"}
            size={isIcon ? "icon" : "sm"}
            disabled={disabled || running}
            className={cn(isIcon && "h-7 w-7", className)}
            aria-label="Bild per KI bearbeiten"
            title="Bild per KI bearbeiten"
          >
            {running ? (
              <Loader2 className={cn("animate-spin", isIcon ? "h-3.5 w-3.5" : "h-3.5 w-3.5")} />
            ) : (
              <Sparkles className={cn(isIcon ? "h-3.5 w-3.5" : "h-3.5 w-3.5")} />
            )}
            {!isIcon && <span className="ml-1.5 text-xs">KI</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.keys(OP_META) as Operation[]).map((op) => {
            const Icon = OP_META[op].icon;
            return (
              <DropdownMenuItem
                key={op}
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmOp(op);
                }}
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {OP_META[op].label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOp !== null} onOpenChange={(o) => { if (!o) setConfirmOp(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmOp && OP_META[confirmOp].title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmOp && OP_META[confirmOp].description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmOp) runOperation(confirmOp);
                setConfirmOp(null);
              }}
            >
              Weiter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
