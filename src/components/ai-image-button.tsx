"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Wand2, RotateCcw } from "lucide-react";

export type AspectPreview = "wide" | "tall";

interface Props {
  /** Größe des Button-Triggers — passt zu den Mini-Action-Buttons in den Bildslots */
  triggerSize?: "icon" | "default";
  /** Aspect des Slots — bestimmt die Vorschau-Form */
  aspect: AspectPreview;
  /** Optionaler Slot-Label für Modal-Title (z.B. "Bild 1 — 15 × 3 cm") */
  slotLabel?: string;
  /** Triggert die Generierung — Aufrufer ruft Server-Action und setzt previewUrl */
  onGenerate: (userPrompt: string) => Promise<void> | void;
  /** Vorschau-URL des aktuellen Generats (signed URL) — null wenn nichts generiert */
  previewUrl: string | null;
  /** Aufrufer übernimmt Bild und schließt Modal selbst */
  onAccept: () => void;
  /** Während Server-Action läuft */
  loading: boolean;
  /** Wenn Modal nicht offen ist, Reset-Hook für Parent (Preview leeren) */
  onClose?: () => void;
  /** Disabled-Hint, z.B. wenn kein API-Key konfiguriert (Tooltip via title-Attribut) */
  disabledHint?: string | null;
}

export function AIImageButton({
  triggerSize = "icon",
  aspect,
  slotLabel,
  onGenerate,
  previewUrl,
  onAccept,
  loading,
  onClose,
  disabledHint,
}: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!open) {
      setPrompt("");
      onClose?.();
    }
    // onClose absichtlich nicht in deps — nur beim Schließen feuern, nicht
    // bei jedem Parent-Re-render des Callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const previewClass = aspect === "wide" ? "aspect-[5/1]" : "aspect-[1/2] max-w-[200px] mx-auto";

  function handleGenerate() {
    if (!prompt.trim()) return;
    void onGenerate(prompt.trim());
  }

  function handleAccept() {
    onAccept();
    setOpen(false);
  }

  return (
    <>
      {triggerSize === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="KI-Bild generieren"
          title={disabledHint ?? "KI-Bild generieren"}
          className="rounded-full bg-background/90 hover:bg-background p-1 border shadow-sm"
        >
          <Wand2 className="h-3 w-3" />
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5"
        >
          <Wand2 className="h-3.5 w-3.5" />
          KI-Bild
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> KI-Bild generieren
            </DialogTitle>
            <DialogDescription>
              {slotLabel ? `${slotLabel} — ` : ""}
              Beschreibe nur das Motiv. Stil (Studio, weißer Hintergrund, Katalog-Qualität)
              wird automatisch ergänzt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ki-bild-prompt">Motiv-Beschreibung</Label>
              <Textarea
                id="ki-bild-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="z. B. LED-Strip warmweiß unter einem modernen Hängeschrank in einer Küche, leuchtet die Arbeitsfläche aus"
                rows={3}
                maxLength={500}
                disabled={loading}
                className="resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {prompt.length}/500 Zeichen · Generierung dauert 10–30 Sekunden.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Vorschau
              </div>
              <div
                className={`flex items-center justify-center overflow-hidden rounded-[12px] border border-primary/30 bg-muted/30 ${previewClass}`}
              >
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generiere Bild…
                  </div>
                ) : previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={previewUrl} alt="KI-Vorschlag" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Beschreibe das Motiv und klick „Generieren"
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Verwerfen
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerate}
              disabled={loading || prompt.trim().length < 3}
              className="gap-1.5"
            >
              {previewUrl ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Neu generieren
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Generieren
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={handleAccept}
              disabled={loading || !previewUrl}
            >
              Übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
