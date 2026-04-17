"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { KatalogJobStatus } from "@/components/katalog-job-status";
import { Trash2, Play, Loader2 } from "lucide-react";
import { deleteKatalogJob, deleteFinishedJobs } from "./actions";
import { useRouter } from "next/navigation";

type Job = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  progress: number;
  pdf_path: string | null;
  error_text: string | null;
  created_at: string;
  parameter: any;
};

export function JobStatusList({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  const finishedCount = jobs.filter((j) => j.status === "done" || j.status === "error").length;

  function handleDelete(jobId: string) {
    setDeletingId(jobId);
    startTransition(async () => {
      const r = await deleteKatalogJob(jobId);
      setDeletingId(null);
      if (r.error) toast.error(r.error);
      else { toast.success("Auftrag gelöscht"); router.refresh(); }
    });
  }

  function handleClearFinished() {
    startTransition(async () => {
      const r = await deleteFinishedJobs();
      if (r.error) toast.error(r.error);
      else { toast.success(`${r.count} Aufträge gelöscht`); router.refresh(); }
    });
  }

  async function handleRetryStart(jobId: string) {
    setStartingId(jobId);
    try {
      const res = await fetch(`/api/katalog-jobs/${jobId}/run`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? "Start fehlgeschlagen");
      } else {
        toast.success("Render-Task gestartet");
        router.refresh();
      }
    } finally {
      setStartingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Letzte Aufträge</CardTitle>
        {finishedCount > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={pending}>
                <Trash2 className="h-4 w-4 mr-1" /> Abgeschlossene löschen ({finishedCount})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Abgeschlossene Aufträge löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  {finishedCount} erfolgreich abgeschlossene oder fehlgeschlagene Aufträge inkl. zugehöriger PDFs werden entfernt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearFinished}>Löschen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.length === 0 && (
          <p className="text-muted-foreground text-sm">Noch keine Katalog-Generierungen.</p>
        )}
        {jobs.map((j) => (
          <div key={j.id} className="rounded border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {new Date(j.created_at).toLocaleString("de-DE")}
              </span>
              <div className="flex items-center gap-2">
                <StatusBadge status={j.status} />
                {j.status === "queued" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetryStart(j.id)}
                    disabled={startingId === j.id || pending}
                    title="Render-Task starten"
                  >
                    {startingId === j.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(j.id)}
                  disabled={deletingId === j.id || pending}
                  aria-label="Auftrag löschen"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {deletingId === j.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {j.parameter?.layout} · {j.parameter?.preisauswahl} · {j.parameter?.preisAenderung}
              {j.parameter?.preisProzent}% · {j.parameter?.waehrung}
            </div>
            <KatalogJobStatus jobId={j.id} initialStatus={j.status} initialProgress={j.progress ?? 0} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Job["status"] }) {
  const map = {
    queued: { label: "wartet", v: "outline" as const },
    running: { label: "läuft", v: "secondary" as const },
    done: { label: "fertig", v: "default" as const },
    error: { label: "Fehler", v: "destructive" as const },
  };
  return <Badge variant={map[status].v}>{map[status].label}</Badge>;
}
