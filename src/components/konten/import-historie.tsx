"use client";

// Client-Komponente fuer die Import-Historie:
//   - Laedt /api/importe
//   - Listet pro Import: Zeitstempel, Dateiname, Konto, Counts (importiert,
//     uebersprungen, fehlerhaft) und die AKTUELLE Anzahl Buchungen.
//   - Pro Zeile: "Rueckgaengig machen"-Button mit Bestaetigungs-Dialog.

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";

import type {
  ImporteListeResponse,
  ImportLaufZeile,
} from "@/app/api/importe/route";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatGroesse(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_PILL: Record<ImportLaufZeile["status"], string> = {
  laeuft: "bg-tint-yellow text-highlight-strong",
  fertig: "bg-tint-cyan text-income-strong",
  fehler: "bg-tint-cerise text-destructive",
};

const STATUS_LABEL: Record<ImportLaufZeile["status"], string> = {
  laeuft: "läuft",
  fertig: "fertig",
  fehler: "rückgängig / Fehler",
};

export function ImportHistorie() {
  const [zeilen, setZeilen] = useState<ImportLaufZeile[]>([]);
  const [laden, setLaden] = useState(true);
  const [zuRueckgaengig, setZuRueckgaengig] = useState<ImportLaufZeile | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const laedeHistorie = useCallback(async () => {
    setLaden(true);
    try {
      const r = await fetch("/api/importe");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as ImporteListeResponse;
      setZeilen(j.data);
    } catch (e) {
      toast.error(
        "Historie konnte nicht geladen werden: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    void laedeHistorie();
  }, [laedeHistorie]);

  function macheRueckgaengig(zeile: ImportLaufZeile) {
    startTransition(async () => {
      try {
        const r = await fetch(`/api/importe/${zeile.id}`, { method: "DELETE" });
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        const j = (await r.json()) as {
          geloescht: number;
          dateiname: string | null;
        };
        toast.success(
          `${j.geloescht} Buchung${j.geloescht === 1 ? "" : "en"} aus "${
            j.dateiname ?? "Import"
          }" geloescht`,
        );
        setZuRueckgaengig(null);
        await laedeHistorie();
      } catch (e) {
        toast.error(
          "Rueckgaengig fehlgeschlagen: " +
            (e instanceof Error ? e.message : "unbekannt"),
        );
      }
    });
  }

  if (laden) {
    return (
      <div className="rounded-[var(--radius)] bg-card px-5 py-8 shadow-[var(--shadow-1)] ring-1 ring-line/60">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Historie wird geladen…
        </div>
      </div>
    );
  }

  if (zeilen.length === 0) {
    return (
      <div className="rounded-[var(--radius)] bg-card px-8 py-12 text-center shadow-[var(--shadow-1)] ring-1 ring-line/60 text-[13px] text-muted-foreground">
        Noch keine Importe vorhanden.
      </div>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
        <ul role="list" className="divide-y divide-line-hair">
          {zeilen.map((z) => {
            const undoMoeglich =
              z.status !== "laeuft" && z.buchungen_aktuell > 0;
            return (
              <li
                key={z.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="truncate text-[14px] font-semibold leading-tight"
                      title={z.dateiname ?? ""}
                    >
                      {z.dateiname ?? "—"}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0 text-[10px] font-semibold",
                        STATUS_PILL[z.status],
                      )}
                    >
                      {STATUS_LABEL[z.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <span className="tabular-nums">{formatDatum(z.created_at)}</span>
                    <span className="text-line-strong">·</span>
                    <span>{formatGroesse(z.dateigroesse)}</span>
                    {z.konto ? (
                      <>
                        <span className="text-line-strong">·</span>
                        <span className="truncate">{z.konto.bezeichnung}</span>
                      </>
                    ) : null}
                  </div>
                  {z.fehler_text ? (
                    <div
                      className="mt-1 truncate text-[11px] text-destructive"
                      title={z.fehler_text}
                    >
                      {z.fehler_text}
                    </div>
                  ) : null}
                </div>
                {/* Counts */}
                <div className="hidden shrink-0 items-baseline gap-4 text-right sm:flex">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      Importiert
                    </div>
                    <div className="font-mono text-[14px] font-bold tabular-nums">
                      {z.protokoll?.importiert ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      Jetzt
                    </div>
                    <div className="font-mono text-[14px] font-bold tabular-nums">
                      {z.buchungen_aktuell}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!undoMoeglich || pending}
                  onClick={() => setZuRueckgaengig(z)}
                  className="rounded-full"
                  title={
                    z.status === "laeuft"
                      ? "Import läuft noch"
                      : z.buchungen_aktuell === 0
                        ? "Keine Buchungen mehr aus diesem Import"
                        : `${z.buchungen_aktuell} Buchungen löschen`
                  }
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Rückgängig
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <AlertDialog
        open={zuRueckgaengig !== null}
        onOpenChange={(open) => {
          if (!open) setZuRueckgaengig(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import rückgängig machen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Damit werden{" "}
                  <span className="font-semibold">
                    {zuRueckgaengig?.buchungen_aktuell ?? 0} Buchungen
                  </span>{" "}
                  aus der Datei{" "}
                  <span className="font-mono">
                    {zuRueckgaengig?.dateiname ?? "—"}
                  </span>{" "}
                  endgültig gelöscht — inkl. ggf. manuell bestätigter Buchungen
                  und ihrer Beleg-Verknüpfungen.
                </p>
                <p className="text-muted-foreground">
                  Lernregeln, Belege aus Paperless und andere Imports bleiben
                  unangetastet.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                if (zuRueckgaengig) macheRueckgaengig(zuRueckgaengig);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-4 w-4" />
              )}
              Endgueltig loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
