"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KatalogJobStatus } from "@/components/katalog-job-status";

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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Letzte Auftraege</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Noch keine Katalog-Generierungen.
          </p>
        )}
        {jobs.map((j) => (
          <div key={j.id} className="rounded border p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(j.created_at).toLocaleString("de-DE")}
              </span>
              <StatusBadge status={j.status} />
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {j.parameter?.layout} · {j.parameter?.preisauswahl} ·{" "}
              {j.parameter?.preisAenderung}
              {j.parameter?.preisProzent}% · {j.parameter?.waehrung}
            </div>
            <KatalogJobStatus
              jobId={j.id}
              initialStatus={j.status}
              initialProgress={j.progress ?? 0}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: Job["status"] }) {
  const map = {
    queued: { label: "wartet", v: "outline" as const },
    running: { label: "laeuft", v: "secondary" as const },
    done: { label: "fertig", v: "default" as const },
    error: { label: "Fehler", v: "destructive" as const },
  };
  return <Badge variant={map[status].v}>{map[status].label}</Badge>;
}
