"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wand2, RefreshCw, Loader2 } from "lucide-react";

interface Props {
  /** Aktuelle Plain-Text-Länge im Editor — Button ist deaktiviert, wenn ≤ enableAt */
  currentLength: number;
  /** Schwelle, ab der der Button aktiv ist (z. B. 1250) */
  enableAt: number;
  /** Zielgrenze, an die die KI den Text kürzt (z. B. 1250) */
  targetMaxChars: number;
  /** Lazy-Getter: wird beim Klick aufgerufen, liefert aktuellen Plain-Text */
  getCurrentText: () => string;
  /** Optional: Produktname für besseren KI-Kontext */
  productName?: string | null;
  /** Wird mit dem gekürzten Text aufgerufen, wenn User auf „Übernehmen" klickt */
  onAccept: (text: string) => void;
  size?: "sm" | "default";
  className?: string;
}

export function AiShortenButton({
  currentLength,
  enableAt,
  targetMaxChars,
  getCurrentText,
  productName,
  onAccept,
  size = "sm",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [shortened, setShortened] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [originalText, setOriginalText] = useState<string>("");

  const disabled = currentLength <= enableAt;

  // Reset Dialog state on close
  useEffect(() => {
    if (!open) {
      setShortened(null);
      setOriginalText("");
    }
  }, [open]);

  async function generate(textToShorten: string) {
    if (!textToShorten.trim()) {
      toast.error("Kein Text zum Kürzen vorhanden.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/text-shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToShorten,
          maxChars: targetMaxChars,
          productName: productName ?? null,
        }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? `Fehler ${res.status}`);
        return;
      }
      setShortened(data.text ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    if (disabled) return;
    const txt = getCurrentText();
    setOriginalText(txt);
    setOpen(true);
    // Sofort generieren — Dialog ist Vorschau, kein Konfigurationsschritt
    void generate(txt);
  }

  function handleAccept() {
    if (!shortened) return;
    onAccept(shortened);
    setOpen(false);
  }

  const newLen = shortened?.length ?? 0;
  const targetReached = newLen > 0 && newLen <= targetMaxChars;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={handleOpen}
        disabled={disabled}
        className={className}
        title={
          disabled
            ? `Text ist bereits kurz genug (${currentLength}/${enableAt} Zeichen)`
            : `Text auf max. ${targetMaxChars} Zeichen kürzen lassen`
        }
      >
        <Wand2 className="h-3.5 w-3.5" />
        KI: Auf Seitenformat kürzen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Text auf Seitenformat kürzen
            </DialogTitle>
            <DialogDescription>
              Die KI kürzt den Text-Block, sodass er komplett in die linke
              Spalte passt (≤ {targetMaxChars} Zeichen). Inhalt und
              Sicherheitshinweise bleiben erhalten.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Original: {originalText.length} Zeichen
              {shortened && (
                <>
                  {" → "}
                  <span
                    className={
                      targetReached
                        ? "text-emerald-600 dark:text-emerald-500 font-medium"
                        : "text-amber-600 dark:text-amber-500 font-medium"
                    }
                  >
                    Neu: {newLen} Zeichen
                    {targetReached ? " ✓" : ` (Ziel: ≤ ${targetMaxChars})`}
                  </span>
                </>
              )}
            </div>

            <div className="rounded-[10px] border border-border/60 bg-muted/30 p-3 min-h-[200px] max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  KI kürzt den Text…
                </div>
              ) : shortened ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{shortened}</p>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Noch kein gekürzter Text.
                </p>
              )}
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
            {shortened && !loading && (
              <Button
                type="button"
                variant="outline"
                onClick={() => generate(originalText)}
                disabled={loading}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Neu generieren
              </Button>
            )}
            <Button
              type="button"
              onClick={handleAccept}
              disabled={loading || !shortened}
            >
              Übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
