"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkles, Loader2, AlertCircle, Check, X } from "lucide-react";
import { applyBulkProduktNamen } from "./actions";

type Status = "pending" | "running" | "done" | "error";

interface ItemInput {
  id: string;
  artikelnummer: string;
  name: string | null;
}

interface ItemState {
  id: string;
  artikelnummer: string;
  currentName: string;
  currentTitel: string;
  suggestedBezeichnung: string | null;
  suggestedTitel: string | null;
  status: Status;
  error: string | null;
  acceptBezeichnung: boolean;
  acceptTitel: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produkte: ItemInput[];
  onApplied: () => void;
}

const CONCURRENCY = 3;

export function BulkNamenWizard({ open, onOpenChange, produkte, onApplied }: Props) {
  const [items, setItems] = useState<ItemState[]>(() => buildInitial(produkte));
  const [zusatz, setZusatz] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const cancelRef = useRef(false);

  // Re-init items when the produkte input changes (e.g. after closing & reopening with a different selection)
  const produkteKey = produkte.map((p) => p.id).join(",");
  const lastKeyRef = useRef(produkteKey);
  if (lastKeyRef.current !== produkteKey) {
    lastKeyRef.current = produkteKey;
    setItems(buildInitial(produkte));
    setZusatz("");
    setRunning(false);
    setSaving(false);
    cancelRef.current = false;
  }

  const total = items.length;
  const doneCount = items.filter((i) => i.status === "done" || i.status === "error").length;
  const acceptedCount = items.filter((i) => i.acceptBezeichnung || i.acceptTitel).length;

  const updateItem = useCallback((id: string, patch: Partial<ItemState>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const startGeneration = useCallback(async () => {
    cancelRef.current = false;
    setRunning(true);
    setItems((prev) => prev.map((it) => (it.status === "done" ? it : { ...it, status: "pending", error: null })));

    const queue = items.filter((it) => it.status !== "done").map((it) => it.id);
    const hint = zusatz.trim() || null;
    let queueIdx = 0;

    async function processOne(id: string) {
      updateItem(id, { status: "running", error: null });
      try {
        const res = await fetch("/api/ai/produkt-namen-bulk-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, zusatzHinweis: hint }),
        });
        const data = await res.json();
        if (!res.ok) {
          updateItem(id, { status: "error", error: data.error ?? `Fehler ${res.status}` });
          return;
        }
        const sb = data.suggested?.bezeichnung as string | undefined;
        const st = data.suggested?.titel as string | undefined;
        if (!sb || !st) {
          updateItem(id, { status: "error", error: "Unvollständige KI-Antwort." });
          return;
        }
        const currentName = (data.current?.name as string | undefined) ?? "";
        const currentTitel = (data.current?.datenblatt_titel as string | undefined) ?? "";
        // Default-Auswahl: leeres oder Artikelnummer-gleiches Feld → Häkchen
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id) return it;
            const isBezEmpty = !currentName.trim() || currentName.trim() === it.artikelnummer.trim();
            const isTitelEmpty = !currentTitel.trim();
            return {
              ...it,
              status: "done",
              error: null,
              currentName,
              currentTitel,
              suggestedBezeichnung: sb,
              suggestedTitel: st,
              acceptBezeichnung: isBezEmpty,
              acceptTitel: isTitelEmpty,
            };
          }),
        );
      } catch (e) {
        updateItem(id, {
          status: "error",
          error: e instanceof Error ? e.message : "Netzwerk-Fehler",
        });
      }
    }

    async function worker() {
      while (queueIdx < queue.length) {
        if (cancelRef.current) return;
        const myIdx = queueIdx++;
        await processOne(queue[myIdx]);
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker());
    await Promise.all(workers);
    setRunning(false);
  }, [items, zusatz, updateItem]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const handleSave = useCallback(async () => {
    const updates = items
      .filter((it) => it.status === "done" && (it.acceptBezeichnung || it.acceptTitel))
      .map((it) => ({
        id: it.id,
        ...(it.acceptBezeichnung && it.suggestedBezeichnung ? { name: it.suggestedBezeichnung } : {}),
        ...(it.acceptTitel && it.suggestedTitel ? { datenblatt_titel: it.suggestedTitel } : {}),
      }));
    if (updates.length === 0) {
      toast.error("Nichts zum Speichern ausgewählt.");
      return;
    }
    setSaving(true);
    try {
      const result = await applyBulkProduktNamen(updates);
      if (result.error) {
        toast.error(`Fehler: ${result.error}`);
        return;
      }
      toast.success(`${result.count} Produkte aktualisiert`);
      onApplied();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [items, onApplied, onOpenChange]);

  const allDone = total > 0 && doneCount === total;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => (running || saving ? null : onOpenChange(o))}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Bulk: Bezeichnung & Titel per KI vorschlagen
          </DialogTitle>
          <DialogDescription>
            {total} Produkt{total === 1 ? "" : "e"} ausgewählt. Default-Häkchen werden gesetzt, wenn
            das Feld leer ist oder die Bezeichnung wortgleich zur Artikelnummer ist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-zusatz" className="text-xs">
              Zusatz-Hinweis für alle Produkte (optional)
            </Label>
            <Textarea
              id="bulk-zusatz"
              value={zusatz}
              onChange={(e) => setZusatz(e.target.value)}
              placeholder="z. B. „Modellname falls aus Artikelnummer ableitbar verwenden“"
              rows={2}
              disabled={running || saving}
              className="resize-none text-sm"
            />
          </div>

          {(running || doneCount > 0) && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {doneCount} / {total} verarbeitet · {acceptedCount} zur Übernahme markiert
                </span>
                {running && <span>läuft…</span>}
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>
          )}

          <ScrollArea className="h-[420px] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[110px]">Artikelnr.</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead>Bezeichnung</TableHead>
                  <TableHead>Datenblatt-Titel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-xs align-top pt-3">
                      {it.artikelnummer}
                    </TableCell>
                    <TableCell className="align-top pt-3">
                      <StatusBadge status={it.status} error={it.error} />
                    </TableCell>
                    <TableCell className="align-top">
                      <FieldCell
                        current={it.currentName}
                        suggested={it.suggestedBezeichnung}
                        accepted={it.acceptBezeichnung}
                        disabled={it.status !== "done"}
                        onToggle={() =>
                          updateItem(it.id, { acceptBezeichnung: !it.acceptBezeichnung })
                        }
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <FieldCell
                        current={it.currentTitel}
                        suggested={it.suggestedTitel}
                        accepted={it.acceptTitel}
                        disabled={it.status !== "done"}
                        onToggle={() =>
                          updateItem(it.id, { acceptTitel: !it.acceptTitel })
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={running || saving}
          >
            Schließen
          </Button>
          {running ? (
            <Button type="button" variant="outline" onClick={cancel} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              Abbrechen
            </Button>
          ) : !allDone ? (
            <Button type="button" onClick={startGeneration} disabled={saving} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {doneCount > 0 ? "Restliche generieren" : "Generieren starten"}
            </Button>
          ) : null}
          {(allDone || (!running && doneCount > 0)) && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || acceptedCount === 0}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {saving ? "Speichere…" : `${acceptedCount} übernehmen & speichern`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildInitial(produkte: ItemInput[]): ItemState[] {
  return produkte.map((p) => ({
    id: p.id,
    artikelnummer: p.artikelnummer,
    currentName: p.name ?? "",
    currentTitel: "",
    suggestedBezeichnung: null,
    suggestedTitel: null,
    status: "pending" as Status,
    error: null,
    acceptBezeichnung: false,
    acceptTitel: false,
  }));
}

function StatusBadge({ status, error }: { status: Status; error: string | null }) {
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> läuft
      </span>
    );
  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
        <Check className="h-3 w-3" /> fertig
      </span>
    );
  if (status === "error")
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-destructive"
        title={error ?? undefined}
      >
        <AlertCircle className="h-3 w-3" /> Fehler
      </span>
    );
  return <span className="text-xs text-muted-foreground/60">offen</span>;
}

function FieldCell({
  current,
  suggested,
  accepted,
  disabled,
  onToggle,
}: {
  current: string;
  suggested: string | null;
  accepted: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5 py-1">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground/70">aktuell</div>
      <div className="text-xs text-muted-foreground line-clamp-2 min-h-[16px]">
        {current || <span className="italic">— leer —</span>}
      </div>
      {suggested ? (
        <>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mt-1">
            KI-Vorschlag
          </div>
          <div className="text-sm font-medium line-clamp-2">{suggested}</div>
          <label className="mt-1 inline-flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <Checkbox checked={accepted} onCheckedChange={onToggle} disabled={disabled} />
            <span>Übernehmen</span>
          </label>
        </>
      ) : (
        <div className="text-[11px] text-muted-foreground/60 mt-1">noch kein Vorschlag</div>
      )}
    </div>
  );
}
