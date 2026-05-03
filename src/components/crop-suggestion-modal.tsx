"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Crop, RotateCcw, SlidersHorizontal, ArrowLeft } from "lucide-react";
import { ManualCropEditor, type ManualCropResult } from "./manual-crop-editor";

export type CropAspect = "wide" | "tall" | "a4";

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
  /**
   * PROJ-41: Manuelles Crop übernehmen.
   * Aufrufer ruft Server-Action `cropKategorieBildManuell` mit den Koordinaten
   * und ersetzt anschließend das Bild. Wenn nicht gesetzt, wird der „Manuell"-Button ausgeblendet.
   */
  onAcceptManual?: (result: ManualCropResult) => Promise<void> | void;
  /** Während Server-Action läuft */
  loading: boolean;
  aspect: CropAspect;
  /** Format-Angabe für die Slot-Position (z.B. "Bild 1 — 15 × 3 cm") */
  slotLabel?: string;
}

type Mode = "compare" | "manual";

export function CropSuggestionModal({
  open,
  onOpenChange,
  originalUrl,
  suggestionUrl,
  onGenerate,
  onAccept,
  onAcceptManual,
  loading,
  aspect,
  slotLabel,
}: Props) {
  const [mode, setMode] = useState<Mode>("compare");
  const [manualResult, setManualResult] = useState<ManualCropResult | null>(null);
  const [manualSaving, setManualSaving] = useState(false);

  const aspectLabel =
    aspect === "wide" ? "5 : 1 (breit)" : aspect === "tall" ? "1 : 2 (hochkant)" : "DIN A4 (hochkant)";
  const previewClass =
    aspect === "wide"
      ? "aspect-[5/1]"
      : aspect === "tall"
      ? "aspect-[1/2] max-w-[180px] mx-auto"
      : "aspect-[210/297] max-w-[260px] mx-auto";

  // Beim Öffnen: zurück in Compare-Modus + Reset
  useEffect(() => {
    if (open) {
      setMode("compare");
      setManualResult(null);
      setManualSaving(false);
    }
  }, [open]);

  async function handleManualSave() {
    if (!manualResult || !onAcceptManual) return;
    setManualSaving(true);
    try {
      await onAcceptManual(manualResult);
    } finally {
      setManualSaving(false);
    }
  }

  // Smart-Crop-Position als Startwert für den manuellen Editor.
  // Der Smart-Crop liefert ein neues Bild, dessen Position relativ zum Original
  // wir nicht kennen. Wir starten daher mit "centered, full aspect" — der Editor
  // initialisiert das selbst, wenn initialCrop nicht gesetzt ist.
  const initialCropForEditor = undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "manual" ? <SlidersHorizontal className="h-4 w-4" /> : <Crop className="h-4 w-4" />}
            {mode === "manual" ? "Manuell zuschneiden" : `Bild auf ${aspectLabel} zuschneiden`}
          </DialogTitle>
          <DialogDescription>
            {slotLabel ? `${slotLabel} — ` : ""}
            {mode === "manual"
              ? `Ziehe das Crop-Rechteck (${aspectLabel}). Aspect-Verhältnis ist gelockt.`
              : "Vorschlag basiert auf dem interessantesten Bildbereich. Vergleiche und entscheide."}
          </DialogDescription>
        </DialogHeader>

        {mode === "compare" ? (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                    <img src={suggestionUrl} alt="Vorschlag" className="h-full w-full object-cover" />
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
              {onAcceptManual && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode("manual")}
                  disabled={loading}
                  className="gap-1.5"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Manuell anpassen
                </Button>
              )}
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
              <Button type="button" onClick={onAccept} disabled={loading || !suggestionUrl}>
                Übernehmen
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <ManualCropEditor
              originalUrl={originalUrl}
              aspect={aspect}
              initialCrop={initialCropForEditor}
              onChange={setManualResult}
            />

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode("compare")}
                disabled={manualSaving}
                className="gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Zurück zum Vergleich
              </Button>
              <Button
                type="button"
                onClick={handleManualSave}
                disabled={manualSaving || !manualResult}
                className="gap-1.5"
              >
                {manualSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Speichere…
                  </>
                ) : (
                  <>
                    <Crop className="h-3.5 w-3.5" />
                    Speichern
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
