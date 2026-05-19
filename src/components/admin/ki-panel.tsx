"use client";

// PROJ-13 — Tab "KI": AI-Gateway-Key (Status statt Klartext) + Modell.
// react-hook-form + zod (gemeinsames Schema). Key-Feld: leer = unverändert.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { aiEinstellungSchema } from "@/lib/validation/admin";
import type { KiStatus } from "@/app/(app)/einstellungen/admin/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

type FormValues = { ai_key: string; ai_model: string };

export function KiPanel({ initialKi }: { initialKi: KiStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialKi);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(aiEinstellungSchema) as any,
    defaultValues: { ai_key: "", ai_model: initialKi.ai_model },
    mode: "onBlur",
  });

  const submitting = form.formState.isSubmitting;
  const keyGesetzt = status.ai_key_gesetzt;

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const res = await fetch("/api/admin/ki", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_key: values.ai_key || undefined,
          ai_model: values.ai_model,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ai_model?: string; ai_key_gesetzt?: boolean; error?: string }
        | null;

      if (!res.ok) {
        const msg = json?.error ?? "Speichern fehlgeschlagen.";
        setServerError(msg);
        toast.error(msg);
        return;
      }
      if (json) {
        setStatus({
          ai_model: json.ai_model ?? values.ai_model,
          ai_key_gesetzt: json.ai_key_gesetzt ?? keyGesetzt,
        });
        form.reset({
          ai_key: "",
          ai_model: json.ai_model ?? values.ai_model,
        });
      }
      toast.success("KI-Einstellungen gespeichert.");
      router.refresh();
    } catch {
      const msg = "Netzwerkfehler. Bitte erneut versuchen.";
      setServerError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>KI-Zugang (AI Gateway)</CardTitle>
          <CardDescription>
            API-Key und Modell für die automatische Klassifizierung. Der DB-Key
            hat Vorrang vor der Server-Umgebungsvariable.
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
                name="ai_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      AI-Gateway-Key
                      {keyGesetzt && (
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
                          keyGesetzt
                            ? "•••••••• (leer lassen = unverändert)"
                            : "vck_..."
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Wird verschlüsselt gespeichert und nie im Klartext
                      angezeigt. Den Key findest du unter vercel.com/dashboard →
                      AI Gateway → API Keys (Format: vck_…).
                      {keyGesetzt
                        ? " Leer lassen, um den gespeicherten Key zu behalten."
                        : ""}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ai_model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modell *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="off"
                        placeholder="anthropic/claude-haiku-4-5"
                      />
                    </FormControl>
                    <FormDescription>
                      Modell-Slug für das AI Gateway. Standard:
                      anthropic/claude-haiku-4-5
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Speichern
                </Button>
                <span className="text-sm text-muted-foreground">
                  Aktueller Status: Key{" "}
                  {keyGesetzt ? "gesetzt" : "nicht gesetzt"} · Modell{" "}
                  {status.ai_model}
                </span>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
