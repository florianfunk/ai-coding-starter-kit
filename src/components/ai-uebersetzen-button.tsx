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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Languages, RefreshCw, Loader2, Check } from "lucide-react";
import {
  TRANSLATABLE_FIELDS,
  TRANSLATABLE_BY_DE,
  type TranslatableField,
} from "@/lib/i18n/translatable-fields";

/** Lazy-Provider — wird beim Klick auf "Generieren" abgefragt, damit der
 *  aktuelle Form-State gelesen wird (nicht der Snapshot beim Mount). */
export type GetItContext = () => {
  produktId: string | null;
  /** DE-Texte pro Feld-Schlüssel (z.B. `name`, `datenblatt_titel`, …). */
  quelltexte: Record<string, string>;
  /** Aktueller IT-Stand pro Feld (zeigt, was bereits gefüllt ist). */
  itAktuell: Record<string, string>;
};

type Result = Record<string, string>;

interface Props {
  /** Welche Felder das Modal anbietet. Default: alle aus TRANSLATABLE_FIELDS.
   *  Pro-Feld-Buttons schicken nur einen Schlüssel. */
  fieldKeys?: readonly string[];
  /** Beschriftung des Trigger-Buttons. */
  triggerLabel?: string;
  /** Trigger-Button-Variante. */
  triggerVariant?: "default" | "outline" | "ghost" | "secondary";
  /** Trigger-Button-Größe. */
  triggerSize?: "sm" | "default" | "icon";
  /** Liefert den aktuellen Kontext beim Klick auf „Generieren". */
  getContext: GetItContext;
  /** Callback pro übernommenem Feld (DE-Schlüssel → IT-Wert). */
  onAccept: (deKey: string, value: string) => void;
  className?: string;
}

export function AiUebersetzenButton({
  fieldKeys,
  triggerLabel,
  triggerVariant = "outline",
  triggerSize = "sm",
  getContext,
  onAccept,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [nurLeere, setNurLeere] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const candidateKeys: readonly string[] =
    fieldKeys ?? TRANSLATABLE_FIELDS.map((f) => f.de);

  const isSingleField = candidateKeys.length === 1;
  const single: TranslatableField | null = isSingleField
    ? TRANSLATABLE_BY_DE[candidateKeys[0]] ?? null
    : null;

  function reset() {
    setResult(null);
    setAccepted(new Set());
  }

  async function generate() {
    const ctx = getContext();
    const felder: string[] = [];
    const quelltexte: Record<string, string> = {};
    for (const key of candidateKeys) {
      const txt = (ctx.quelltexte[key] ?? "").trim();
      if (!txt) continue;
      if (nurLeere && (ctx.itAktuell[key] ?? "").trim()) continue;
      felder.push(key);
      quelltexte[key] = txt;
    }
    if (felder.length === 0) {
      toast.error(
        nurLeere
          ? "Keine Felder zu übersetzen — alle IT-Felder sind bereits gefüllt."
          : "Keine deutschen Texte vorhanden, die übersetzt werden könnten.",
      );
      return;
    }

    setLoading(true);
    setAccepted(new Set());
    try {
      const res = await fetch("/api/ai/uebersetzen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produktId: ctx.produktId,
          zielsprache: "it",
          felder,
          quelltexte,
          nurLeere,
        }),
      });
      const data = (await res.json()) as
        | { uebersetzungen: Record<string, string> }
        | { error: string };
      if (!res.ok || "error" in data) {
        const err = "error" in data ? data.error : `Fehler ${res.status}`;
        toast.error(err);
        return;
      }
      setResult(data.uebersetzungen);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setLoading(false);
    }
  }

  function handleAcceptOne(deKey: string) {
    if (!result) return;
    const value = result[deKey];
    if (typeof value !== "string") return;
    onAccept(deKey, value);
    setAccepted((prev) => {
      const next = new Set(prev);
      next.add(deKey);
      return next;
    });
    toast.success(`${TRANSLATABLE_BY_DE[deKey]?.label ?? deKey} übernommen`);
  }

  function handleAcceptAll() {
    if (!result) return;
    let count = 0;
    for (const key of Object.keys(result)) {
      const value = result[key];
      if (typeof value !== "string") continue;
      onAccept(key, value);
      count += 1;
    }
    setAccepted(new Set(Object.keys(result)));
    toast.success(`${count} Übersetzung${count === 1 ? "" : "en"} übernommen`);
    setOpen(false);
    reset();
  }

  function handleClose(o: boolean) {
    setOpen(o);
    if (!o) reset();
  }

  const triggerText =
    triggerLabel ??
    (isSingleField ? "Übersetzen" : "🇮🇹 Alle Felder übersetzen");

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        onClick={() => setOpen(true)}
        className={className}
      >
        <Languages className="h-3.5 w-3.5" />
        {triggerText}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              {single
                ? `Italienische Übersetzung — ${single.label}`
                : "Italienische Übersetzung der Datenblatt-Felder"}
            </DialogTitle>
            <DialogDescription>
              {single
                ? "Die KI übersetzt das Feld ins Italienische. Technische Begriffe (CRI, IP, K, Lumen) bleiben unverändert."
                : "Die KI übersetzt alle datenblatt-relevanten Felder ins Italienische. Technische Begriffe (CRI, IP, K, Lumen) und HTML-Struktur bleiben erhalten."}
            </DialogDescription>
          </DialogHeader>

          {!isSingleField && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={nurLeere}
                onCheckedChange={(v) => setNurLeere(v === true)}
                disabled={loading}
              />
              <span>Nur Felder übersetzen, deren italienische Version noch leer ist</span>
            </label>
          )}

          <ScrollArea className="max-h-[440px] rounded-md border">
            <div className="space-y-3 p-3">
              {loading && !result ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  KI übersetzt …
                </div>
              ) : result ? (
                <ResultList
                  candidateKeys={candidateKeys}
                  result={result}
                  accepted={accepted}
                  onAcceptOne={handleAcceptOne}
                />
              ) : (
                <PreviewList
                  candidateKeys={candidateKeys}
                  getContext={getContext}
                  nurLeere={nurLeere}
                />
              )}
            </div>
          </ScrollArea>

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
              <Button
                type="button"
                onClick={generate}
                disabled={loading}
                className="gap-1.5"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Languages className="h-3.5 w-3.5" />
                )}
                {loading ? "Übersetze…" : "Übersetzen"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleAcceptAll}
                disabled={loading}
                className="gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                {isSingleField ? "Übernehmen" : "Alle übernehmen"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PreviewList({
  candidateKeys,
  getContext,
  nurLeere,
}: {
  candidateKeys: readonly string[];
  getContext: GetItContext;
  nurLeere: boolean;
}) {
  const ctx = getContext();
  const rows = candidateKeys
    .map((key) => {
      const field = TRANSLATABLE_BY_DE[key];
      if (!field) return null;
      const de = (ctx.quelltexte[key] ?? "").trim();
      const it = (ctx.itAktuell[key] ?? "").trim();
      const willSkip = !de || (nurLeere && it);
      return { key, field, de, it, willSkip };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  const willTranslateCount = rows.filter((r) => !r.willSkip).length;

  return (
    <>
      <p className="text-xs text-muted-foreground">
        {willTranslateCount} von {rows.length} Feldern werden übersetzt — Klick auf
        „Übersetzen“, um zu starten.
      </p>
      {rows.map((r) => (
        <div
          key={r.key}
          className={`rounded-md border bg-background p-2 text-xs ${
            r.willSkip ? "opacity-50" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{r.field.label}</span>
            {r.willSkip ? (
              <span className="text-muted-foreground">übersprungen</span>
            ) : (
              <span className="text-emerald-600">wird übersetzt</span>
            )}
          </div>
          <div className="mt-1 text-muted-foreground line-clamp-2">
            {r.de || <span className="italic">— deutsches Feld leer —</span>}
          </div>
        </div>
      ))}
    </>
  );
}

function ResultList({
  candidateKeys,
  result,
  accepted,
  onAcceptOne,
}: {
  candidateKeys: readonly string[];
  result: Record<string, string>;
  accepted: Set<string>;
  onAcceptOne: (key: string) => void;
}) {
  const rows = candidateKeys
    .map((key) => {
      const field = TRANSLATABLE_BY_DE[key];
      if (!field) return null;
      const it = result[key];
      if (typeof it !== "string") return null;
      return { key, field, it };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Keine Übersetzungen erhalten.
      </p>
    );
  }

  return (
    <>
      {rows.map((r) => {
        const isAccepted = accepted.has(r.key);
        return (
          <div key={r.key} className="rounded-md border bg-background p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {r.field.label} (IT)
              </span>
              <Button
                type="button"
                size="sm"
                variant={isAccepted ? "secondary" : "outline"}
                onClick={() => onAcceptOne(r.key)}
                className="h-7 gap-1 px-2 text-xs"
              >
                {isAccepted ? (
                  <>
                    <Check className="h-3 w-3" /> übernommen
                  </>
                ) : (
                  "Übernehmen"
                )}
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-sm">{r.it}</p>
          </div>
        );
      })}
    </>
  );
}
