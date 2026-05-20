"use client";

// PROJ-5: "Klassifizierung starten"-Aktion + Job-Fortschritt.
// Startet die serverseitige Pipeline und pollt den job_lauf-Status.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import type { JobLauf } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface KonsistenzPassErgebnis {
  empfaenger_geprueft?: number;
  empfaenger_angepasst?: number;
  buchungen_angepasst?: number;
  empfaenger_uneinheitlich?: number;
}

interface KlassErgebnis {
  verarbeitet?: number;
  auto_verbucht?: number;
  zur_pruefung?: number;
  via_regel?: number;
  via_ki?: number;
  uebersprungen_manuell?: number;
  fehler?: Array<{ buchung_id: string; grund: string }>;
  /** PROJ-15: Phase-2-Statistik des Konsistenz-Passes (optional). */
  konsistenz_pass?: KonsistenzPassErgebnis | null;
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

function formatDatum(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function KlassifizierungPanel({
  initialJob,
}: {
  initialJob: JobLauf | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<JobLauf | null>(initialJob);
  const [busy, setBusy] = useState(false);
  const [reklassifizieren, setReklassifizieren] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/klassifizierung", { method: "GET" });
      if (!res.ok) return;
      const json = (await res.json()) as { job: JobLauf | null };
      setJob(json.job);
      if (json.job && json.job.status !== "laeuft") {
        stopPolling();
        setBusy(false);
        router.refresh();
      }
    } catch {
      // Polling-Fehler ignorieren, nächster Tick versucht es erneut.
    }
  }, [router, stopPolling]);

  useEffect(() => {
    if (job?.status === "laeuft" && !pollRef.current) {
      pollRef.current = setInterval(pollStatus, 2000);
    }
    return stopPolling;
  }, [job?.status, pollStatus, stopPolling]);

  async function starten() {
    setBusy(true);
    try {
      const res = await fetch("/api/klassifizierung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nur_offen: !reklassifizieren }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Klassifizierung fehlgeschlagen");
        setBusy(false);
        return;
      }
      const e = json.ergebnis as KlassErgebnis;
      toast.success(
        `Fertig: ${e.auto_verbucht ?? 0} auto-verbucht, ${
          e.zur_pruefung ?? 0
        } zur Prüfung`,
      );
      await pollStatus();
      setBusy(false);
      router.refresh();
    } catch {
      toast.error("Netzwerkfehler bei der Klassifizierung");
      setBusy(false);
    }
  }

  const e = (job?.ergebnis as KlassErgebnis | null) ?? {};
  const fehler = e.fehler ?? [];
  const laeuft = job?.status === "laeuft" || busy;
  const gesamt = job?.gesamt ?? 0;
  const prozent =
    gesamt > 0
      ? Math.min(100, Math.round(((job?.fortschritt ?? 0) / gesamt) * 100))
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Autonome Klassifizierung</CardTitle>
        <CardDescription>
          Der Agent ordnet jede Buchung zu (privat/geschäftlich,
          Steuerrelevanz, EÜR-Kategorie). Lernregeln haben Vorrang vor der KI.
          Manuell bestätigte Buchungen werden nie überschrieben.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={starten} disabled={laeuft}>
            {laeuft ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {laeuft ? "Läuft…" : "Klassifizierung starten"}
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              id="reklass"
              checked={reklassifizieren}
              onCheckedChange={setReklassifizieren}
              disabled={laeuft}
            />
            <Label htmlFor="reklass" className="text-sm">
              Re-Klassifizierung (alle außer manuell bestätigt)
            </Label>
          </div>
        </div>

        {job && (
          <div className="space-y-3 rounded-md border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Letzter Lauf</span>
                <Badge variant={STATUS_VARIANT[job.status]}>
                  {STATUS_LABEL[job.status]}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDatum(job.created_at)}
              </span>
            </div>

            {job.status === "laeuft" && (
              <div className="space-y-1">
                <Progress value={prozent} />
                <p className="text-xs text-muted-foreground">
                  {job.fortschritt} / {gesamt} Buchungen
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="default">
                Auto-verbucht: {e.auto_verbucht ?? 0}
              </Badge>
              <Badge variant="secondary">
                Zur Prüfung: {e.zur_pruefung ?? 0}
              </Badge>
              <Badge variant="outline">Per Regel: {e.via_regel ?? 0}</Badge>
              <Badge variant="outline">Per KI: {e.via_ki ?? 0}</Badge>
              {(e.uebersprungen_manuell ?? 0) > 0 && (
                <Badge variant="outline">
                  Geschützt: {e.uebersprungen_manuell}
                </Badge>
              )}
              {fehler.length > 0 && (
                <Badge variant="destructive">Fehler: {fehler.length}</Badge>
              )}
            </div>

            {job.status === "fehler" && job.fehler_text && (
              <Alert variant="destructive">
                <AlertTitle>Lauf abgebrochen</AlertTitle>
                <AlertDescription>
                  {job.fehler_text} Bereits klassifizierte Buchungen bleiben
                  erhalten — ein erneuter Lauf setzt fort.
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
                    <li key={i} className="text-muted-foreground">
                      {f.grund}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {e.konsistenz_pass && (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                <div className="font-medium">Konsistenz-Pass (Phase 2)</div>
                <p className="text-xs text-muted-foreground">
                  Empfaenger mit mehreren Kategorien wurden auf die
                  Mehrheits-Kategorie zusammengezogen — manuell bestaetigte
                  Buchungen bleiben unangetastet.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    Geprueft: {e.konsistenz_pass.empfaenger_geprueft ?? 0}
                  </Badge>
                  <Badge variant="default">
                    Angepasst: {e.konsistenz_pass.empfaenger_angepasst ?? 0}
                  </Badge>
                  <Badge variant="secondary">
                    Buchungen: {e.konsistenz_pass.buchungen_angepasst ?? 0}
                  </Badge>
                  <Badge variant="outline">
                    Uneinheitlich: {e.konsistenz_pass.empfaenger_uneinheitlich ?? 0}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
