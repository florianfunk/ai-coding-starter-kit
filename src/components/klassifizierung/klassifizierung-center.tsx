"use client";

// PROJ-24: Klassifizierung-Center — Status-Statistik + Lauf-Steuerung mit
// Auto-Continue (zeitbegrenzte Batches werden automatisch fortgesetzt).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle2, StopCircle } from "lucide-react";
import type { JobLauf } from "@/lib/types";
import type {
  JahrStat,
  KlassifizierungStatistik,
} from "@/lib/klassifizierung/statistik";
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

interface KlassErgebnis {
  verarbeitet?: number;
  auto_verbucht?: number;
  zur_pruefung?: number;
  via_regel?: number;
  via_ki?: number;
  via_vorjahr?: number;
  zeitlimit_erreicht?: boolean;
  verbleibend?: number;
}

interface SessionAggregat {
  batches: number;
  verarbeitet: number;
  auto_verbucht: number;
  zur_pruefung: number;
  via_vorjahr: number;
  via_regel: number;
  via_ki: number;
}

const LEER_AGG: SessionAggregat = {
  batches: 0,
  verarbeitet: 0,
  auto_verbucht: 0,
  zur_pruefung: 0,
  via_vorjahr: 0,
  via_regel: 0,
  via_ki: 0,
};

function pct(teil: number, ganz: number): number {
  if (ganz <= 0) return 0;
  return Math.min(100, Math.round((teil / ganz) * 100));
}

export function KlassifizierungCenter({
  statistik,
  initialJob,
}: {
  statistik: KlassifizierungStatistik;
  initialJob: JobLauf | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<JobLauf | null>(initialJob);
  const [running, setRunning] = useState(false);
  const [reklassifizieren, setReklassifizieren] = useState(false);
  const [agg, setAgg] = useState<SessionAggregat>(LEER_AGG);
  const stopRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/klassifizierung", { method: "GET" });
      if (!res.ok) return;
      const json = (await res.json()) as { job: JobLauf | null };
      setJob(json.job);
    } catch {
      // nächster Tick versucht es erneut
    }
  }, []);

  // Fortschritt eines laufenden Batches pollen.
  useEffect(() => {
    if (running && !pollRef.current) {
      pollRef.current = setInterval(pollStatus, 2000);
    }
    if (!running && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [running, pollStatus]);

  const starteSession = useCallback(async () => {
    if (running) return;
    stopRef.current = false;
    setAgg(LEER_AGG);
    setRunning(true);
    let lokal = { ...LEER_AGG };
    try {
      let weiter = true;
      while (weiter && !stopRef.current) {
        const res = await fetch("/api/klassifizierung", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nur_offen: !reklassifizieren }),
        });
        const json = (await res.json().catch(() => null)) as
          | { ergebnis?: KlassErgebnis; error?: string }
          | null;
        if (!res.ok) {
          toast.error(json?.error ?? "Klassifizierung fehlgeschlagen");
          break;
        }
        const e = json?.ergebnis ?? {};
        lokal = {
          batches: lokal.batches + 1,
          verarbeitet: lokal.verarbeitet + (e.verarbeitet ?? 0),
          auto_verbucht: lokal.auto_verbucht + (e.auto_verbucht ?? 0),
          zur_pruefung: lokal.zur_pruefung + (e.zur_pruefung ?? 0),
          via_vorjahr: lokal.via_vorjahr + (e.via_vorjahr ?? 0),
          via_regel: lokal.via_regel + (e.via_regel ?? 0),
          via_ki: lokal.via_ki + (e.via_ki ?? 0),
        };
        setAgg(lokal);
        // Server-Statistik live aktualisieren.
        router.refresh();
        // Weiter, solange zeitbegrenzt abgebrochen UND noch Rest UND dieser
        // Batch tatsächlich etwas geschafft hat (Schutz gegen Endlosschleife).
        weiter =
          !!e.zeitlimit_erreicht &&
          (e.verbleibend ?? 0) > 0 &&
          (e.verarbeitet ?? 0) > 0;
      }
      if (stopRef.current) {
        toast.info(`Gestoppt nach ${lokal.verarbeitet} verarbeiteten Buchungen.`);
      } else {
        toast.success(
          `Fertig: ${lokal.verarbeitet} verarbeitet (${lokal.via_vorjahr} aus Vorjahr, ${lokal.auto_verbucht} auto, ${lokal.zur_pruefung} zur Prüfung) in ${lokal.batches} Durchläufen.`,
        );
      }
    } finally {
      setRunning(false);
      router.refresh();
    }
  }, [running, reklassifizieren, router]);

  const gesamt = statistik.gesamt;
  const allesVerarbeitet = gesamt.total > 0 && gesamt.offen === 0;

  return (
    <div className="space-y-6">
      {/* Status-Überblick gesamt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Status
            {allesVerarbeitet && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Alles verarbeitet
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {gesamt.verarbeitet} von {gesamt.total} Buchungen verarbeitet
            {gesamt.offen > 0 ? ` · noch ${gesamt.offen} offen` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={pct(gesamt.verarbeitet, gesamt.total)} />
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">Offen: {gesamt.offen}</Badge>
            <Badge variant="secondary">Zur Prüfung: {gesamt.zur_pruefung}</Badge>
            <Badge variant="outline">Auto-verbucht: {gesamt.auto_verbucht}</Badge>
            <Badge variant="outline">
              Manuell bestätigt: {gesamt.manuell_bestaetigt}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Per Regel: {gesamt.via_regel}</span>
            <span>· Aus Vorjahr: {gesamt.via_vorjahr}</span>
            <span>· Per KI: {gesamt.via_ki}</span>
            <span>· Manuell: {gesamt.via_manuell}</span>
          </div>
        </CardContent>
      </Card>

      {/* Pro Jahr */}
      {statistik.jahre.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {statistik.jahre.map((j) => (
            <JahrKarte key={j.jahr} stat={j} />
          ))}
        </div>
      )}

      {/* Lauf-Steuerung */}
      <Card>
        <CardHeader>
          <CardTitle>Klassifizierung starten</CardTitle>
          <CardDescription>
            Verarbeitet alle noch offenen Buchungen. Lange Läufe werden
            automatisch in mehreren Durchläufen fortgesetzt, bis nichts mehr
            offen ist. Manuell bestätigte Buchungen werden nie überschrieben.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {running ? (
              <Button variant="destructive" onClick={() => (stopRef.current = true)}>
                <StopCircle className="mr-2 h-4 w-4" />
                Nach aktuellem Durchlauf stoppen
              </Button>
            ) : (
              <Button onClick={starteSession} disabled={gesamt.offen === 0 && !reklassifizieren}>
                <Sparkles className="mr-2 h-4 w-4" />
                Klassifizierung starten
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="reklass"
                checked={reklassifizieren}
                onCheckedChange={setReklassifizieren}
                disabled={running}
              />
              <Label htmlFor="reklass" className="text-sm">
                Re-Klassifizierung (alle außer manuell bestätigt)
              </Label>
            </div>
          </div>

          {running && (
            <div className="space-y-2 rounded-md border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                Läuft… Durchlauf {agg.batches + 1}
              </div>
              {job?.status === "laeuft" && (job.gesamt ?? 0) > 0 && (
                <>
                  <Progress value={pct(job.fortschritt ?? 0, job.gesamt ?? 0)} />
                  <p className="text-xs text-muted-foreground">
                    Aktueller Durchlauf: {job.fortschritt} / {job.gesamt}
                  </p>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Bisher in dieser Sitzung: {agg.verarbeitet} verarbeitet (
                {agg.via_vorjahr} aus Vorjahr, {agg.auto_verbucht} auto,{" "}
                {agg.zur_pruefung} zur Prüfung).
              </p>
            </div>
          )}

          {!running && allesVerarbeitet && (
            <Alert>
              <AlertTitle>Alle Buchungen sind verarbeitet</AlertTitle>
              <AlertDescription>
                Es ist nichts mehr offen. Unsichere Fälle findest du in der
                Prüfliste.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JahrKarte({ stat }: { stat: JahrStat }) {
  const offenWarnung = stat.offen > 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{stat.jahr}</span>
          {offenWarnung ? (
            <Badge variant="secondary">{stat.offen} offen</Badge>
          ) : (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> fertig
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {stat.verarbeitet} von {stat.total} verarbeitet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress value={pct(stat.verarbeitet, stat.total)} />
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span>Auto: {stat.auto_verbucht}</span>
          <span>· Prüfung: {stat.zur_pruefung}</span>
          <span>· Manuell: {stat.manuell_bestaetigt}</span>
          {stat.via_vorjahr > 0 && <span>· Vorjahr: {stat.via_vorjahr}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
