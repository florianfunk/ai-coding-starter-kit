"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Crop, RotateCcw } from "lucide-react";

export type CropAspect = "wide" | "tall";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quell-URL des Originals (signed URL zur Vorschau) */
  originalUrl: string;
  /** Quell-URL des Vorschlags (signed URL zur Vorschau) — null wenn noch nicht generiert */
  suggestionUrl: string | null;
  /** Triggert (Neu-)Generierung — Parent ruft Server-Action und setzt suggestionUrl */
  onGenerate: () => void;
  /** Übernimmt den Vorschlag — Aufrufer schließt selbst und ersetzt Bild */
  onAccept: () => void;
  /** Während Server-Action läuft */
  loading: boolean;
  aspect: CropAspect;
  /** Format-Angabe für die Slot-Position (z.B. "Bild 1 — 15 × 3 cm") */
  slotLabel?: string;
}

export function CropSuggestionModal({
  open,
  onOpenChange,
  originalUrl,
  suggestionUrl,
  onGenerate,
  onAccept,
  loading,
  aspect,
  slotLabel,
}: Props) {
  const aspectLabel = aspect === "wide" ? "5 : 1 (breit)" : "1 : 2 (hochkant)";
  const previewClass = aspect === "wide" ? "aspect-[5/1]" : "aspect-[1/2] max-w-[180px] mx-auto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-4 w-4" /> Bild auf {aspectLabel} zuschneiden
          </DialogTitle>
          <DialogDescription>
            {slotLabel ? `${slotLabel} — ` : ""}
            Vorschlag basiert auf dem interessantesten Bildbereich. Vergleiche und entscheide.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Original
            </div>
            <div className="overflow-hidden rounded-[12px] border border-border/60 bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={originalUrl} alt="Original" className="w-full object-contain" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Vorschlag (Smart-Crop)
            </div>
            <div
              className={`flex items-center justify-center overflow-hidden rounded-[12px] border border-primary/30 bg-muted/30 ${previewClass}`}
            >
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generiere…
                </div>
              ) : suggestionUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={suggestionUrl}
                  alt="Vorschlag"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm text-muted-foreground">Klick „Vorschlag generieren"</span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Original behalten
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onGenerate()}
            disabled={loading}
            className="gap-1.5"
          >
            {suggestionUrl ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                Neu generieren
              </>
            ) : (
              <>
                <Crop className="h-3.5 w-3.5" />
                Vorschlag generieren
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={onAccept}
            disabled={loading || !suggestionUrl}
          >
            Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
