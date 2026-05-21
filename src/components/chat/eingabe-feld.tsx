"use client";

// PROJ-17 — Eingabefeld unten in der Konversationsansicht.
//
// - Multi-Line Textarea, 1-4 Zeilen automatisch waechst (via JS-Ref)
// - Enter sendet, Shift+Enter = Zeilenumbruch
// - Senden-Button rechts neben dem Feld
// - Waehrend Streaming: Button disabled, Loader-Icon, Textarea bleibt offen
// - Zeichen-Counter erst ab 500 Zeichen sichtbar

import { useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  wert: string;
  onChange: (v: string) => void;
  onSenden: () => void;
  streamt: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_ZEILEN = 4;
const ZEICHEN_WARNUNG = 500;
const ZEICHEN_MAX = 4000;

export function EingabeFeld({
  wert,
  onChange,
  onSenden,
  streamt,
  disabled,
  placeholder = "Frag mich etwas zu deinen Buchungen…",
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Auto-Resize: Hoehe an Inhalt anpassen, bis max. MAX_ZEILEN.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight || "20");
    const maxHeight = lineHeight * MAX_ZEILEN + 16; // + padding
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
  }, [wert]);

  const kannSenden =
    wert.trim().length > 0 &&
    wert.length <= ZEICHEN_MAX &&
    !streamt &&
    !disabled;

  function senden() {
    if (!kannSenden) return;
    onSenden();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      senden();
    }
  }

  const zeichenSichtbar = wert.length >= ZEICHEN_WARNUNG;
  const zuLang = wert.length > ZEICHEN_MAX;

  return (
    <div className="border-t bg-background">
      <div className="mx-auto w-full max-w-3xl p-3 sm:p-4">
        <div className="relative flex items-end gap-2">
          <Textarea
            ref={ref}
            value={wert}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            aria-label="Nachricht an den KI-Chat"
            className={cn(
              "min-h-[44px] resize-none overflow-y-auto pr-2 text-sm leading-6",
              zuLang && "border-destructive",
            )}
          />
          <Button
            type="button"
            onClick={senden}
            disabled={!kannSenden}
            size="icon"
            aria-label={streamt ? "Antwort wird gestreamt" : "Senden"}
            className="h-11 w-11 shrink-0"
          >
            {streamt ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="hidden sm:inline">
            Enter = Senden · Shift+Enter = Zeilenumbruch
          </span>
          <span className={cn("ml-auto tabular-nums", zuLang && "text-destructive")}
            aria-live="polite"
          >
            {zeichenSichtbar ? `${wert.length} / ${ZEICHEN_MAX}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
