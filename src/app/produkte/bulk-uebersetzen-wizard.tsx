"use client";

import { useCallback, useRef, useState } from "react";
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
import { Languages, Loader2, AlertCircle, Check, X } from "lucide-react";

type Status = "pending" | "running" | "done" | "error";

interface ItemInput {
  id: string;
  artikelnummer: string;
}

interface ItemState {
  id: string;
  artikelnummer: string;
  status: Status;
  error: string | null;
  /** Anzahl Felder, die geschrieben wurden. */
  written: number;
  /** Anzahl Felder, die übersprungen wurden (DE leer oder IT bereits gefüllt). */
  skipped: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produkte: ItemInput[];
  onApplied: () => void;
}

/** Bulk-Übersetzung läuft sequenziell, weil die LLM-Latenz pro Request bei
 *  5–15 s liegt und das gemeinsame Rate-Limit (60 / h / IP) sonst zu schnell
 *  erreicht wird. Eine Concurrency von 1 hält die Logik einfach. */
const CONCURRENCY = 1;

export function BulkUebersetzenWizard({
  open,
  onOpenChange,
  produkte,
  onApplied,
}: Props) {
  const [items, setItems] = useState<ItemState[]>(() => buildInitial(produkte));
  const [nurLeere, setNurLeere] = useState(true);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);
  const appliedRef = useRef(false);

  // Re-init items when the produkte input changes
  const produkteKey = produkte.map((p) => p.id).join(",");
  const lastKeyRef = useRef(produkteKey);
  if (lastKeyRef.current !== produkteKey) {
    lastKeyRef.current = produkteKey;
    setItems(buildInitial(produkte));
    setNurLeere(true);
    setRunning(false);
    cancelRef.current = false;
    appliedRef.current = false;
  }

  const total = items.length;
  const doneCount = items.filter((i) => i.status === "done" || i.status === "error").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const writtenSum = items.reduce((s, i) => s + i.written, 0);

  const updateItem = useCallback((id: string, patch: Partial<ItemState>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const startBulk = useCallback(async () => {
    cancelRef.current = false;
    setRunning(true);
    setItems((prev) =>
      prev.map((it) =>
        it.status === "done"
          ? it
          : { ...it, status: "pending", error: null, written: 0, skipped: 0 },
      ),
    );

    const queue = items.filter((it) => it.status !== "done").map((it) => it.id);
    let queueIdx = 0;

    async function processOne(id: string) {
      updateItem(id, { status: "running", error: null });
      try {
        const res = await fetch("/api/ai/uebersetzen-bulk-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produktId: id,
            zielsprache: "it",
            nurLeere,
          }),
        });
        const data = (await res.json()) as
          | { written: number; skipped: number }
          | { error: string };
        if (!res.ok || "error" in data) {
          const err = "error" in data ? data.error : `Fehler ${res.status}`;
          updateItem(id, { status: "error", error: err });
          return;
        }
        updateItem(id, {
          status: "done",
          written: data.written,
          skipped: data.skipped,
        });
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

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, queue.length) },
      () => worker(),
    );
    await Promise.all(workers);
    setRunning(false);
    if (writtenSum > 0 || queue.length > 0) {
      appliedRef.current = true;
    }
  }, [items, nurLeere, updateItem, writtenSum]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const handleClose = useCallback(
    (o: boolean) => {
      if (running) return;
      if (!o && appliedRef.current) {
        onApplied();
      }
      onOpenChange(o);
    },
    [running, onApplied, onOpenChange],
  );

  const allDone = total > 0 && doneCount === total;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-4 w-4" /> Bulk: Italienische Übersetzung
          </DialogTitle>
          <DialogDescription>
            {total} Produkt{total === 1 ? "" : "e"} ausgewählt. Die KI übersetzt alle
            datenblatt-relevanten Felder ins Italienische und schreibt sie direkt in die
            Datenbank.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={nurLeere}
              onCheckedChange={(v) => setNurLeere(v === true)}
              disabled={running}
            />
            <span>
              Nur leere IT-Felder überschreiben{" "}
              <span className="text-xs text-muted-foreground">
                (empfohlen — schützt manuelle Korrekturen)
              </span>
            </span>
          </label>

          {(running || doneCount > 0) && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {doneCount} / {total} verarbeitet · {writtenSum} Felder geschrieben
                  {errorCount > 0 && (
                    <span className="ml-2 text-destructive">
                      · {errorCount} Fehler
                    </span>
                  )}
                </span>
                {running && <span>läuft…</span>}
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>
          )}

          <ScrollArea className="h-[360px] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[140px]">Artikelnr.</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Ergebnis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-xs">{it.artikelnummer}</TableCell>
                    <TableCell>
                      <StatusBadge status={it.status} error={it.error} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {it.status === "done" && (
                        <>
                          {it.written} geschrieben
                          {it.skipped > 0 && ` · ${it.skipped} übersprungen`}
                        </>
                      )}
                      {it.status === "error" && (
                        <span className="text-destructive">{it.error}</span>
                      )}
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
            onClick={() => handleClose(false)}
            disabled={running}
          >
            Schließen
          </Button>
          {running ? (
            <Button type="button" variant="outline" onClick={cancel} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              Abbrechen
            </Button>
          ) : !allDone ? (
            <Button type="button" onClick={startBulk} className="gap-1.5">
              <Languages className="h-3.5 w-3.5" />
              {doneCount > 0 ? "Restliche übersetzen" : "Übersetzung starten"}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Fertig
            </span>
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
    status: "pending" as Status,
    error: null,
    written: 0,
    skipped: 0,
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
