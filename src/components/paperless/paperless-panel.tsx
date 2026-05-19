"use client";

// PROJ-3: Paperless-Verbindung + Sync (Client).
// react-hook-form + zod (gemeinsames Schema), shadcn/ui-Primitiven.
// Token-Feld: Status statt Klartext; leer lassen = unverändert.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, PlugZap, RefreshCw } from "lucide-react";

import {
  paperlessVerbindungSchema,
  type PaperlessVerbindungInput,
} from "@/lib/validation/paperless";
import type { JobLauf } from "@/lib/types";
import type { VerbindungStatus } from "@/app/(app)/einstellungen/paperless/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SyncStatus } from "./sync-status";

type FormValues = { base_url: string; token: string };

function defaultsFrom(v: VerbindungStatus | null): FormValues {
  return { base_url: v?.base_url ?? "", token: "" };
}

export function PaperlessPanel({
  initialVerbindung,
  initialJob,
}: {
  initialVerbindung: VerbindungStatus | null;
  initialJob: JobLauf | null;
}) {
  const router = useRouter();
  const [verbindung, setVerbindung] = useState(initialVerbindung);
  const [job, setJob] = useState<JobLauf | null>(initialJob);
  const [serverError, setServerError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string } | null
  >(null);
  const [syncBusy, setSyncBusy] = useState(false);

  // Filter-State
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [tag, setTag] = useState("");
  const [korrespondent, setKorrespondent] = useState("");
  // Default "Rechnungen": nur Buchhaltungsbelege aus diesem Paperless-
  // Speicherpfad importieren (nicht Arztrechnungen/Versicherungen etc.).
  const [speicherpfad, setSpeicherpfad] = useState("Rechnungen");

  const tokenGesetzt = verbindung?.token_gesetzt ?? false;

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(paperlessVerbindungSchema) as any,
    defaultValues: defaultsFrom(initialVerbindung),
    mode: "onBlur",
  });

  const submitting = form.formState.isSubmitting;

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setTestResult(null);
    const payload: PaperlessVerbindungInput = {
      base_url: values.base_url,
      token: values.token || undefined,
    };
    try {
      const res = await fetch("/api/paperless", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        verbindung?: VerbindungStatus;
        error?: string;
      } | null;

      if (!res.ok) {
        const msg = json?.error ?? "Speichern fehlgeschlagen.";
        setServerError(msg);
        toast.error(msg);
        return;
      }
      if (json?.verbindung) {
        setVerbindung(json.verbindung);
        form.reset({ base_url: json.verbindung.base_url, token: "" });
      }
      toast.success("Paperless-Verbindung gespeichert.");
      router.refresh();
    } catch {
      const msg = "Netzwerkfehler. Bitte erneut versuchen.";
      setServerError(msg);
      toast.error(msg);
    }
  }

  async function handleTest() {
    setTestBusy(true);
    setTestResult(null);
    try {
      const base_url = form.getValues("base_url");
      const token = form.getValues("token");
      // Wenn Felder ausgefüllt: diese testen, sonst gespeicherte Verbindung.
      const body =
        base_url || token
          ? JSON.stringify({ base_url, token: token || undefined })
          : "";
      const res = await fetch("/api/paperless/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;
      if (res.ok && json?.ok) {
        setTestResult({
          ok: true,
          message: json.message ?? "Verbindung erfolgreich.",
        });
        toast.success("Verbindung erfolgreich.");
      } else {
        const msg = json?.error ?? "Verbindungstest fehlgeschlagen.";
        setTestResult({ ok: false, message: msg });
        toast.error(msg);
      }
    } catch {
      setTestResult({
        ok: false,
        message: "Netzwerkfehler beim Verbindungstest.",
      });
    } finally {
      setTestBusy(false);
    }
  }

  async function handleSync() {
    setSyncBusy(true);
    setServerError(null);
    try {
      const filter: Record<string, string> = {};
      if (von) filter.von = von;
      if (bis) filter.bis = bis;
      if (tag) filter.tag = tag;
      if (korrespondent) filter.korrespondent = korrespondent;
      if (speicherpfad.trim()) filter.speicherpfad = speicherpfad.trim();

      const res = await fetch("/api/paperless/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filter),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        ergebnis?: Record<string, unknown>;
      } | null;

      // Aktuellen Job-Status nachladen (auch bei Teil-Fehler).
      await refreshJob();

      if (!res.ok || !json?.ok) {
        const msg = json?.error ?? "Sync fehlgeschlagen.";
        toast.error(msg);
        return;
      }
      toast.success("Sync abgeschlossen.");
      router.refresh();
    } catch {
      toast.error("Netzwerkfehler beim Sync.");
    } finally {
      setSyncBusy(false);
    }
  }

  async function refreshJob() {
    try {
      const res = await fetch("/api/paperless/sync");
      const json = (await res.json().catch(() => null)) as {
        job?: JobLauf | null;
      } | null;
      if (res.ok) setJob(json?.job ?? null);
    } catch {
      // Stillschweigend: nächste Aktion versucht erneut.
    }
  }

  return (
    <div className="space-y-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Verbindungs-Formular */}
      <Card>
        <CardHeader>
          <CardTitle>Verbindung</CardTitle>
          <CardDescription>
            Basis-URL und API-Token deiner Paperless-ngx-Instanz. HTTPS wird
            empfohlen (Steuerdaten).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="base_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Basis-URL *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://paperless.example.com"
                        autoComplete="url"
                        inputMode="url"
                      />
                    </FormControl>
                    <FormDescription>
                      Ohne abschließenden Schrägstrich, z. B.
                      https://paperless.example.com
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      API-Token
                      {tokenGesetzt && (
                        <Badge variant="secondary" className="ml-2">
                          gesetzt
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="off"
                        placeholder={
                          tokenGesetzt
                            ? "•••••••• (leer lassen = unverändert)"
                            : "Paperless-API-Token"
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Wird verschlüsselt gespeichert und nie im Klartext
                      angezeigt.
                      {tokenGesetzt
                        ? " Leer lassen, um den gespeicherten Token zu behalten."
                        : ""}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {testResult && (
                <Alert
                  variant={testResult.ok ? "default" : "destructive"}
                >
                  <AlertTitle>
                    {testResult.ok
                      ? "Verbindung erfolgreich"
                      : "Verbindung fehlgeschlagen"}
                  </AlertTitle>
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Speichern
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={testBusy}
                >
                  {testBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlugZap className="mr-2 h-4 w-4" />
                  )}
                  Verbindung testen
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Sync */}
      <Card>
        <CardHeader>
          <CardTitle>Belege synchronisieren</CardTitle>
          <CardDescription>
            Importiert alle (oder gefilterte) Dokumente aus Paperless.
            Bereits importierte Belege werden aktualisiert, nicht dupliziert.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="filter-speicherpfad"
              className="text-sm font-medium"
            >
              Speicherpfad (enthält)
            </label>
            <Input
              id="filter-speicherpfad"
              value={speicherpfad}
              onChange={(e) => setSpeicherpfad(e.target.value)}
              placeholder="z. B. Rechnungen"
            />
            <p className="text-xs text-muted-foreground">
              Nur Belege aus diesem Paperless-Speicherpfad werden importiert.
              Standard: „Rechnungen“ (Buchhaltungsbelege). Leer lassen, um alle
              Dokumente zu importieren.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="filter-von"
                className="text-sm font-medium"
              >
                Belegdatum von
              </label>
              <Input
                id="filter-von"
                type="date"
                value={von}
                onChange={(e) => setVon(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="filter-bis"
                className="text-sm font-medium"
              >
                Belegdatum bis
              </label>
              <Input
                id="filter-bis"
                type="date"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="filter-tag"
                className="text-sm font-medium"
              >
                Tag (enthält)
              </label>
              <Input
                id="filter-tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="z. B. Steuer"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="filter-korr"
                className="text-sm font-medium"
              >
                Korrespondent (enthält)
              </label>
              <Input
                id="filter-korr"
                value={korrespondent}
                onChange={(e) => setKorrespondent(e.target.value)}
                placeholder="z. B. Telekom"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Hinweis: „In Quelle entfernt"-Markierung erfolgt nur bei
            ungefiltertem Sync.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSync}
              disabled={syncBusy || !tokenGesetzt}
            >
              {syncBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync starten
            </Button>
            {!tokenGesetzt && (
              <span className="text-sm text-muted-foreground">
                Bitte zuerst Verbindung speichern.
              </span>
            )}
          </div>

          <SyncStatus job={job} lastSyncAt={verbindung?.last_sync_at ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
