"use client";

// PROJ-3: Sync-Status-Anzeige (neu/aktualisiert/Fehler/Zeitstempel).

import type { JobLauf } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface SyncErgebnis {
  neu?: number;
  aktualisiert?: number;
  unveraendert?: number;
  unvollstaendig?: number;
  quelle_entfernt?: number;
  fehler?: Array<{ paperless_id: number | null; grund: string }>;
}

function formatDatum(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const STATUS_LABEL: Record<JobLauf["status"], string> = {
  laeuft: "Läuft",
  fertig: "Fertig",
  fehler: "Fehler",
};

const STATUS_VARIANT: Record<
  JobLauf["status"],
  "default" | "secondary" | "destructive"
> = {
  laeuft: "secondary",
  fertig: "default",
  fehler: "destructive",
};

export function SyncStatus({
  job,
  lastSyncAt,
}: {
  job: JobLauf | null;
  lastSyncAt: string | null;
}) {
  if (!job) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Noch kein Sync durchgeführt.
        </p>
        {lastSyncAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            Letzter erfolgreicher Sync: {formatDatum(lastSyncAt)}
          </p>
        )}
      </div>
    );
  }

  const e = (job.ergebnis as SyncErgebnis | null) ?? {};
  const fehler = e.fehler ?? [];

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Letzter Sync</span>
          <Badge variant={STATUS_VARIANT[job.status]}>
            {STATUS_LABEL[job.status]}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDatum(job.created_at)}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="default">Neu: {e.neu ?? 0}</Badge>
        <Badge variant="secondary">
          Aktualisiert: {e.aktualisiert ?? 0}
        </Badge>
        <Badge variant="outline">
          Unverändert: {e.unveraendert ?? 0}
        </Badge>
        <Badge variant="outline">
          Unvollständig: {e.unvollstaendig ?? 0}
        </Badge>
        {(e.quelle_entfernt ?? 0) > 0 && (
          <Badge variant="outline">
            In Quelle entfernt: {e.quelle_entfernt}
          </Badge>
        )}
        {fehler.length > 0 && (
          <Badge variant="destructive">Fehler: {fehler.length}</Badge>
        )}
      </div>

      {job.status === "laeuft" && (
        <p className="text-sm text-muted-foreground">
          Sync läuft… verarbeitet: {job.fortschritt}
          {job.gesamt ? ` / ${job.gesamt}` : ""}
        </p>
      )}

      {job.status === "fehler" && job.fehler_text && (
        <Alert variant="destructive">
          <AlertTitle>Sync abgebrochen</AlertTitle>
          <AlertDescription>
            {job.fehler_text} Bereits importierte Belege bleiben erhalten —
            ein erneuter Sync setzt fort.
          </AlertDescription>
        </Alert>
      )}

      {fehler.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            Fehlerliste ({fehler.length})
          </summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {fehler.slice(0, 100).map((f, i) => (
              <li
                key={i}
                className="text-muted-foreground"
              >
                {f.paperless_id != null
                  ? `Dokument #${f.paperless_id}: `
                  : ""}
                {f.grund}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
