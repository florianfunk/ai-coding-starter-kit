"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getKatalogJob } from "./actions";

type Job = {
  id: string; status: "queued" | "running" | "done" | "error";
  progress: number; pdf_path: string | null; error_text: string | null; created_at: string;
  parameter: any;
};

export function JobStatusList({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const active = jobs.some((j) => j.status === "queued" || j.status === "running");
    if (!active) return;
    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [jobs, router]);

  // Resolve signed URLs for done jobs
  useEffect(() => {
    (async () => {
      for (const j of jobs) {
        if (j.status === "done" && j.pdf_path && !pdfUrls[j.id]) {
          const r = await getKatalogJob(j.id);
          if (r.pdfUrl) setPdfUrls((prev) => ({ ...prev, [j.id]: r.pdfUrl! }));
        }
      }
    })();
  }, [jobs, pdfUrls]);

  return (
    <Card>
      <CardHeader><CardTitle>Letzte Aufträge</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {jobs.length === 0 && <p className="text-muted-foreground text-sm">Noch keine Katalog-Generierungen.</p>}
        {jobs.map((j) => (
          <div key={j.id} className="rounded border p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{new Date(j.created_at).toLocaleString("de-DE")}</span>
              <StatusBadge status={j.status} />
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {j.parameter?.layout} · {j.parameter?.preisauswahl} · {j.parameter?.preisAenderung}
              {j.parameter?.preisProzent}% · {j.parameter?.waehrung}
            </div>
            {(j.status === "queued" || j.status === "running") && <Progress value={j.progress} className="h-2" />}
            {j.status === "done" && pdfUrls[j.id] && (
              <Button asChild size="sm">
                <a href={pdfUrls[j.id]} target="_blank" rel="noreferrer">PDF herunterladen</a>
              </Button>
            )}
            {j.status === "error" && j.error_text && (
              <p className="text-sm text-destructive">{j.error_text}</p>
            )}
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
