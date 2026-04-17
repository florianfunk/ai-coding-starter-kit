"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Clock, Loader2, CheckCircle, XCircle, Download } from "lucide-react";

type JobStatus = "queued" | "running" | "done" | "error";

interface KatalogJobStatusProps {
  jobId: string;
  initialStatus: JobStatus;
  initialProgress: number;
}

interface JobResponse {
  status: JobStatus;
  progress: number;
  pdfUrl: string | null;
  errorText: string | null;
}

export function KatalogJobStatus({
  jobId,
  initialStatus,
  initialProgress,
}: KatalogJobStatusProps) {
  const [status, setStatus] = useState<JobStatus>(initialStatus);
  const [progress, setProgress] = useState(initialProgress);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasToastedRef = useRef(false);

  const isActive = status === "queued" || status === "running";

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/katalog-jobs/${jobId}`);
      if (!res.ok) return;
      const data: JobResponse = await res.json();

      setStatus(data.status);
      setProgress(data.progress);

      if (data.status === "done") {
        setPdfUrl(data.pdfUrl);
        if (!hasToastedRef.current) {
          toast.success("Katalog-PDF ist fertig!");
          hasToastedRef.current = true;
        }
      }

      if (data.status === "error") {
        setErrorText(data.errorText);
        if (!hasToastedRef.current) {
          toast.error(data.errorText ?? "Ein Fehler ist aufgetreten");
          hasToastedRef.current = true;
        }
      }
    } catch {
      // Silently ignore network errors during polling
    }
  }, [jobId]);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Fetch immediately, then poll
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, fetchStatus]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <StatusIcon status={status} />
        <span className="text-sm font-medium">
          <StatusText status={status} progress={progress} />
        </span>
      </div>

      {(status === "queued" || status === "running") && (
        <div className="flex items-center gap-3">
          <Progress
            value={progress}
            className="h-2.5 flex-1"
            indicatorClassName={
              status === "running"
                ? "bg-blue-500 transition-all duration-500"
                : ""
            }
          />
          <span className="text-xs font-mono text-muted-foreground w-8 text-right">
            {progress}%
          </span>
        </div>
      )}

      {status === "done" && (
        <div className="flex items-center gap-3">
          <Progress
            value={100}
            className="h-2.5 flex-1"
            indicatorClassName="bg-green-500"
          />
          <span className="text-xs font-mono text-green-600 w-8 text-right">
            100%
          </span>
        </div>
      )}

      {status === "done" && pdfUrl && (
        <Button
          asChild
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white mt-1"
        >
          <a href={pdfUrl} target="_blank" rel="noreferrer">
            <Download className="mr-2 h-4 w-4" />
            PDF herunterladen
          </a>
        </Button>
      )}

      {status === "error" && errorText && (
        <p className="text-sm text-destructive">{errorText}</p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: JobStatus }) {
  switch (status) {
    case "queued":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "done":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
  }
}

function StatusText({
  status,
  progress,
}: {
  status: JobStatus;
  progress: number;
}) {
  switch (status) {
    case "queued":
      return "In Warteschlange...";
    case "running":
      return `Wird generiert... (${progress}%)`;
    case "done":
      return "Fertig!";
    case "error":
      return "Fehler";
  }
}
