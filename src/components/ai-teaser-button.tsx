"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";

export type TeaserEntityType = "bereich" | "kategorie" | "produkt";
export type TeaserLaenge = "kurz" | "mittel" | "lang";

interface Props {
  entityType: TeaserEntityType;
  entityName: string;
  entityContext?: string | null;
  onAccept: (text: string) => void;
  size?: "sm" | "default";
  className?: string;
}

export function AITeaserButton({
  entityType,
  entityName,
  entityContext,
  onAccept,
  size = "sm",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [zusatz, setZusatz] = useState("");
  const [laenge, setLaenge] = useState<TeaserLaenge>("mittel");
  const [teaser, setTeaser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setTeaser(null);
    setZusatz("");
    setLaenge("mittel");
  }

  async function generate() {
    if (!entityName.trim()) {
      toast.error("Name fehlt — bitte zuerst einen Namen eintragen.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/teaser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityName,
          entityContext: entityContext ?? null,
          zusatzHinweis: zusatz.trim() || null,
          laenge,
        }),
      });
      const data = (await res.json()) as { teaser?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? `Fehler ${res.status}`);
        return;
      }
      setTeaser(data.teaser ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setLoading(false);
    }
  }

  function handleAccept() {
    if (!teaser) return;
    onAccept(teaser);
    setOpen(false);
    reset();
  }

  function handleClose(o: boolean) {
    setOpen(o);
    if (!o) reset();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
        className={className}
      >
        <Sparkles className="h-3.5 w-3.5" />
        KI-Teaser
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> KI-Teaser generieren
            </DialogTitle>
            <DialogDescription>
              Marketing-Teaser für{" "}
              <span className="font-medium text-foreground">{entityName || "(unbenannt)"}</span>.
              Nicht zufrieden? Einfach neu generieren.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="teaser-zusatz">Zusatz-Hinweis (optional)</Label>
                <Textarea
                  id="teaser-zusatz"
                  value={zusatz}
                  onChange={(e) => setZusatz(e.target.value)}
                  placeholder="z. B. Fokus auf Profi-Anwendung, Preis-Highlight, Energieeffizienz…"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="teaser-laenge">Länge</Label>
                <Select
                  value={laenge}
                  onValueChange={(v) => setLaenge(v as TeaserLaenge)}
                >
                  <SelectTrigger id="teaser-laenge">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kurz">Kurz (1 Satz)</SelectItem>
                    <SelectItem value="mittel">Mittel (2–3 Sätze)</SelectItem>
                    <SelectItem value="lang">Lang (Absatz)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-[10px] border border-border/60 bg-muted/30 p-3 min-h-[120px]">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  KI generiert Text…
                </div>
              ) : teaser ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{teaser}</p>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Klick auf „Generieren", um einen Teaser zu erstellen.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              Verwerfen
            </Button>
            {teaser && !loading && (
              <Button
                type="button"
                variant="outline"
                onClick={generate}
                disabled={loading}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Neu generieren
              </Button>
            )}
            {!teaser ? (
              <Button type="button" onClick={generate} disabled={loading} className="gap-1.5">
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {loading ? "Generiere…" : "Generieren"}
              </Button>
            ) : (
              <Button type="button" onClick={handleAccept} disabled={loading}>
                Übernehmen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
