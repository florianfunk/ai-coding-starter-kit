"use client";

// PROJ-13 — Tab "System": Status-Kacheln aus /api/admin/status.
// Lade-, Fehler- und Leerzustände werden explizit behandelt.

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import type { JobLauf } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface StatusResponse {
  supabase_ok: boolean;
  paperless_konfiguriert: boolean;
  ki_konfiguriert: boolean;
  ki_quelle: "db" | "env" | null;
  ki_model: string;
  est_tarife: number[];
  letzte_jobs: Record<string, JobLauf | null>;
}

const JOB_LABEL: Record<string, string> = {
  paperless_sync: "Letzter Paperless-Sync",
  konto_import: "Letzter Kontoimport",
  klassifizierung: "Letzte Klassifizierung",
};

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <Badge variant={ok ? "default" : "destructive"}>
      {ok ? "OK" : "Nicht konfiguriert"}
    </Badge>
  );
}

function formatDatum(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SystemPanel() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLoading(true);
    setFehler(null);
    try {
      const res = await fetch("/api/admin/status");
      const json = (await res.json().catch(() => null)) as
        | (StatusResponse & { error?: string })
        | null;
      if (!res.ok || !json) {
        setFehler(json?.error ?? "Status konnte nicht geladen werden.");
        return;
      }
      setData(json);
    } catch {
      setFehler("Netzwerkfehler beim Laden des Status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Überblick über Konfiguration und letzte Hintergrund-Läufe.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void laden()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Aktualisieren
        </Button>
      </div>

      {fehler && (
        <Alert variant="destructive">
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Status wird geladen…
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Supabase</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBadge ok={data.supabase_ok} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Paperless</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBadge ok={data.paperless_konfiguriert} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">KI</CardTitle>
                <CardDescription>
                  {data.ki_konfiguriert
                    ? `Quelle: ${
                        data.ki_quelle === "db" ? "Datenbank" : "Umgebung"
                      } · Modell: ${data.ki_model}`
                    : "Weder DB-Key noch Umgebungs-Key gesetzt"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StatusBadge ok={data.ki_konfiguriert} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">ESt-Tarife</CardTitle>
              </CardHeader>
              <CardContent>
                {data.est_tarife.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {data.est_tarife.map((j) => (
                      <Badge key={j} variant="secondary">
                        {j}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Keine Tarife hinterlegt
                  </span>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Letzte Läufe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(JOB_LABEL).map(([art, label]) => {
                const job = data.letzte_jobs[art] ?? null;
                return (
                  <div
                    key={art}
                    className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-sm">{label}</span>
                    {job ? (
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge
                          variant={
                            job.status === "fehler"
                              ? "destructive"
                              : job.status === "fertig"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {job.status}
                        </Badge>
                        {formatDatum(job.created_at)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Noch nie ausgeführt
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
