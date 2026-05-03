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
import { Sparkles, RefreshCw, Loader2, Check } from "lucide-react";

export interface AiNamenContext {
  artikelnummer: string;
  bereichName?: string | null;
  kategorieName?: string | null;
  infoKurz?: string | null;
  technischeDaten?: Record<string, string> | null;
}

interface Props {
  /** Lazy getter — wird erst beim Klick auf "Generieren" ausgewertet,
   *  damit die KI immer den aktuellen Form-State kennt. */
  getContext: () => AiNamenContext;
  onAcceptBezeichnung: (value: string) => void;
  onAcceptTitel: (value: string) => void;
  className?: string;
}

type Result = { bezeichnung: string; titel: string };

export function AiNamenButton({
  getContext,
  onAcceptBezeichnung,
  onAcceptTitel,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [zusatz, setZusatz] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptedBezeichnung, setAcceptedBezeichnung] = useState(false);
  const [acceptedTitel, setAcceptedTitel] = useState(false);

  function reset() {
    setResult(null);
    setZusatz("");
    setAcceptedBezeichnung(false);
    setAcceptedTitel(false);
  }

  async function generate() {
    const ctx = getContext();
    if (!ctx.artikelnummer.trim()) {
      toast.error("Artikelnummer fehlt — bitte zuerst eintragen.");
      return;
    }
    setLoading(true);
    setAcceptedBezeichnung(false);
    setAcceptedTitel(false);
    try {
      const res = await fetch("/api/ai/produkt-namen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikelnummer: ctx.artikelnummer,
          bereichName: ctx.bereichName ?? null,
          kategorieName: ctx.kategorieName ?? null,
          infoKurz: ctx.infoKurz ?? null,
          technischeDaten: ctx.technischeDaten ?? null,
          zusatzHinweis: zusatz.trim() || null,
        }),
      });
      const data = (await res.json()) as Partial<Result> & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? `Fehler ${res.status}`);
        return;
      }
      if (!data.bezeichnung || !data.titel) {
        toast.error("KI-Antwort unvollständig.");
        return;
      }
      setResult({ bezeichnung: data.bezeichnung, titel: data.titel });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setLoading(false);
    }
  }

  function handleAcceptBezeichnung() {
    if (!result) return;
    onAcceptBezeichnung(result.bezeichnung);
    setAcceptedBezeichnung(true);
    toast.success("Bezeichnung übernommen");
  }

  function handleAcceptTitel() {
    if (!result) return;
    onAcceptTitel(result.titel);
    setAcceptedTitel(true);
    toast.success("Titel übernommen");
  }

  function handleAcceptBoth() {
    if (!result) return;
    onAcceptBezeichnung(result.bezeichnung);
    onAcceptTitel(result.titel);
    setAcceptedBezeichnung(true);
    setAcceptedTitel(true);
    toast.success("Bezeichnung & Titel übernommen");
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
        size="sm"
        onClick={() => setOpen(true)}
        className={className}
      >
        <Sparkles className="h-3.5 w-3.5" />
        KI: Bezeichnung & Titel
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Bezeichnung & Titel vorschlagen
            </DialogTitle>
            <DialogDescription>
              Aus den vorhandenen technischen Daten generiert die KI zwei Vorschläge:
              eine kompakte Bezeichnung für Listen und einen Titel für das PDF-Datenblatt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="namen-zusatz">Zusatz-Hinweis (optional)</Label>
              <Textarea
                id="namen-zusatz"
                value={zusatz}
                onChange={(e) => setZusatz(e.target.value)}
                placeholder="z. B. „Modellname STEPLIGHT verwenden“, „Marke betonen“…"
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <div className="rounded-[10px] border border-border/60 bg-muted/30 p-3 min-h-[140px]">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  KI generiert Vorschläge…
                </div>
              ) : result ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-border/60 bg-background p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Bezeichnung
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={acceptedBezeichnung ? "secondary" : "outline"}
                        onClick={handleAcceptBezeichnung}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        {acceptedBezeichnung ? (
                          <>
                            <Check className="h-3 w-3" /> übernommen
                          </>
                        ) : (
                          "Übernehmen"
                        )}
                      </Button>
                    </div>
                    <p className="text-sm font-medium">{result.bezeichnung}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Datenblatt-Titel
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={acceptedTitel ? "secondary" : "outline"}
                        onClick={handleAcceptTitel}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        {acceptedTitel ? (
                          <>
                            <Check className="h-3 w-3" /> übernommen
                          </>
                        ) : (
                          "Übernehmen"
                        )}
                      </Button>
                    </div>
                    <p className="text-sm font-medium">{result.titel}</p>
                  </div>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Klick auf „Generieren", um Vorschläge zu erstellen.
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
              Schließen
            </Button>
            {result && !loading && (
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
            {!result ? (
              <Button type="button" onClick={generate} disabled={loading} className="gap-1.5">
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {loading ? "Generiere…" : "Generieren"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleAcceptBoth}
                disabled={loading}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Beide übernehmen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
