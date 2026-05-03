"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Loader2,
  AlertTriangle,
  FileSearch,
  Crown,
  Wand2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { bildProxyUrl } from "@/lib/bild-url";
import {
  analyzeDubletten,
  consolidateDubletten,
  deleteOrphanedDubletten,
  type DubletteAnalysisResult,
} from "./actions";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type Stage = "idle" | "analyzed" | "consolidated";

export function DublettenAnalyzer() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<DubletteAnalysisResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // hashes
  const [stage, setStage] = useState<Stage>("idle");
  const [orphans, setOrphans] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleStart() {
    startTransition(async () => {
      try {
        const r = await analyzeDubletten();
        setResult(r);
        setStage("analyzed");
        setOrphans([]);
        // Default: alle Gruppen ausgewählt
        setSelected(new Set(r.duplicateGroups.map((g) => g.hash)));
        if (r.duplicateGroups.length === 0) {
          toast.success(`Keine Dubletten — ${r.scannedFiles} Bilder geprüft.`);
        } else {
          toast.success(
            `${r.duplicateGroups.length} Gruppen — ${formatBytes(r.bytesSavable)} einsparbar.`,
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Analyse fehlgeschlagen");
      }
    });
  }

  function toggleGroup(hash: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }

  function toggleAll() {
    if (!result) return;
    if (selected.size === result.duplicateGroups.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(result.duplicateGroups.map((g) => g.hash)));
    }
  }

  const selectedGroups = useMemo(() => {
    if (!result) return [];
    return result.duplicateGroups.filter((g) => selected.has(g.hash));
  }, [result, selected]);

  const selectedStats = useMemo(() => {
    return {
      groups: selectedGroups.length,
      files: selectedGroups.reduce((s, g) => s + g.files.length - 1, 0),
      bytes: selectedGroups.reduce((s, g) => s + g.bytesSavable, 0),
      refs: selectedGroups.reduce((s, g) => s + g.dbReferencesToRewrite, 0),
    };
  }, [selectedGroups]);

  function handleConsolidate() {
    if (selectedGroups.length === 0) return;
    startTransition(async () => {
      try {
        const plan = selectedGroups.map((g) => ({
          masterPath: g.masterPath,
          duplicatePaths: g.files
            .filter((f) => f.path !== g.masterPath)
            .map((f) => f.path),
        }));
        const r = await consolidateDubletten(plan);
        setOrphans(r.orphanedPaths);
        setStage("consolidated");
        if (r.ok) {
          toast.success(
            `${r.rewrittenReferences} DB-Referenzen umgebogen, ${r.orphanedPaths.length} Dateien jetzt verwaist.`,
          );
        } else {
          toast.error(
            `Mit Fehlern abgeschlossen — ${r.errors.length} Probleme. Bitte Details prüfen.`,
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Konsolidierung fehlgeschlagen");
      }
    });
  }

  function handleDeleteOrphans() {
    if (orphans.length === 0) return;
    startTransition(async () => {
      try {
        const r = await deleteOrphanedDubletten(orphans);
        if (r.ok) {
          toast.success(`${r.deletedCount} verwaiste Dateien gelöscht.`);
          // Reset für nächste Runde
          setStage("idle");
          setResult(null);
          setOrphans([]);
          setSelected(new Set());
        } else {
          toast.error(
            `${r.deletedCount} gelöscht, ${r.errors.length} Fehler, ${r.skippedPaths.length} übersprungen.`,
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Löschung fehlgeschlagen");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">
              {stage === "idle" ? "Analyse starten" : "Erneut analysieren"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lädt jedes Bild mit Größen-Kollision herunter und berechnet einen
              SHA-256-Hash. Bei ~1000 Bildern dauert das einige Sekunden bis
              Minuten — bitte den Tab nicht schließen.
            </p>
          </div>
          <Button onClick={handleStart} disabled={pending} className="gap-2">
            {pending && stage === "idle" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analysiere…
              </>
            ) : (
              <>
                <FileSearch className="h-4 w-4" />
                {stage === "idle" ? "Analyse starten" : "Neu analysieren"}
              </>
            )}
          </Button>
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Bilder geprüft" value={result.scannedFiles.toString()} />
            <Stat
              label="Dubletten-Gruppen"
              value={result.duplicateGroups.length.toString()}
            />
            <Stat
              label="Überflüssige Dateien"
              value={result.uniqueDuplicateFiles.toString()}
            />
            <Stat
              label="Einsparbar"
              value={formatBytes(result.bytesSavable)}
              highlight={result.bytesSavable > 0}
            />
          </div>

          {/* Aktions-Leiste */}
          {stage === "analyzed" && result.duplicateGroups.length > 0 && (
            <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3 text-sm">
                <Checkbox
                  checked={
                    selected.size === result.duplicateGroups.length
                      ? true
                      : selected.size === 0
                        ? false
                        : "indeterminate"
                  }
                  onCheckedChange={toggleAll}
                  aria-label="Alle umschalten"
                />
                <span>
                  {selectedStats.groups} von {result.duplicateGroups.length}{" "}
                  Gruppen ausgewählt
                </span>
                {selectedStats.groups > 0 && (
                  <span className="text-muted-foreground">
                    · {selectedStats.files} Dateien · {formatBytes(selectedStats.bytes)} ·{" "}
                    {selectedStats.refs} DB-Refs
                  </span>
                )}
              </div>
              <Button
                onClick={handleConsolidate}
                disabled={pending || selectedGroups.length === 0}
                className="gap-2"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Biege um…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" /> DB-Referenzen umbiegen
                  </>
                )}
              </Button>
            </div>
          )}

          {stage === "consolidated" && (
            <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40">
              <div className="flex items-center gap-2 text-sm text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                {orphans.length} Dateien sind jetzt verwaist und können gelöscht werden.
              </div>
              {orphans.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={pending}
                  className="gap-2"
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Lösche…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" /> {orphans.length} Dateien löschen
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {result.errors.length} Fehler beim Hashen
              </div>
              <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                {result.errors.slice(0, 10).map((e) => (
                  <li key={e.path}>
                    <code>{e.path}</code> — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.duplicateGroups.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">Gefundene Dubletten-Gruppen</h2>
              {result.duplicateGroups.map((g) => {
                const isSelected = selected.has(g.hash);
                return (
                  <div
                    key={g.hash}
                    className={`overflow-hidden rounded-lg border bg-card transition-colors ${
                      isSelected ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2 text-xs">
                      <div className="flex items-center gap-3">
                        {stage === "analyzed" && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleGroup(g.hash)}
                            aria-label="Gruppe auswählen"
                          />
                        )}
                        <code className="text-muted-foreground">
                          {g.hash.slice(0, 12)}…
                        </code>
                        <span className="text-muted-foreground">
                          {formatBytes(g.size)} pro Datei
                        </span>
                        <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
                          {g.files.length}× vorhanden
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>spart {formatBytes(g.bytesSavable)}</span>
                        {g.dbReferencesToRewrite > 0 && (
                          <span>{g.dbReferencesToRewrite} DB-Refs umzubiegen</span>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {g.files.map((f) => {
                        const isMaster = f.path === g.masterPath;
                        const url = bildProxyUrl("produktbilder", f.path);
                        return (
                          <div
                            key={f.path}
                            className={`overflow-hidden rounded-md border-2 ${
                              isMaster
                                ? "border-primary"
                                : "border-transparent bg-muted/20"
                            }`}
                          >
                            <div className="relative h-32 bg-muted/40">
                              {url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={url}
                                  alt={f.smartTitle}
                                  className="absolute inset-0 h-full w-full object-contain p-2"
                                  loading="lazy"
                                />
                              )}
                              {isMaster && (
                                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
                                  <Crown className="h-3 w-3" /> Master
                                </span>
                              )}
                              {f.usageCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 rounded-full bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">
                                  {f.usageCount}× genutzt
                                </span>
                              )}
                            </div>
                            <div className="border-t p-2">
                              <div
                                className="line-clamp-2 text-[11px] font-medium"
                                title={f.smartTitle}
                              >
                                {f.smartTitle}
                              </div>
                              <div
                                className="mt-1 truncate text-[10px] text-muted-foreground"
                                title={f.path}
                              >
                                {f.path}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {orphans.length} Dateien endgültig löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Die Dateien werden aus dem Storage entfernt. Vor dem Löschen wird
              für jede Datei nochmal verifiziert, dass keine DB-Referenz mehr
              existiert. Diese Aktion ist nicht rückgängig zu machen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrphans}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-card p-3 ${
        highlight ? "border-primary/40 bg-primary/5" : ""
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
