"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Save } from "lucide-react";
import { updateAiEinstellungen, type AiFormState } from "./ai-actions";

const initial: AiFormState = { error: null };

export function AiTab({ settings }: { settings: { replicate_token: string | null } | null }) {
  const [state, formAction, pending] = useActionState(
    async (prev: AiFormState, fd: FormData) => {
      const r = await updateAiEinstellungen(prev, fd);
      if (!r.error) toast.success("Gespeichert");
      return r;
    },
    initial,
  );
  const [show, setShow] = useState(false);
  const hasToken = !!settings?.replicate_token;

  return (
    <Card>
      <CardHeader>
        <CardTitle>KI / Bildbearbeitung</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="replicate_token">Replicate API-Token</Label>
            <div className="flex gap-2">
              <Input
                id="replicate_token"
                name="replicate_token"
                type={show ? "text" : "password"}
                defaultValue={settings?.replicate_token ?? ""}
                placeholder={hasToken ? "••••••••••••••••" : "r8_..."}
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Token verstecken" : "Token anzeigen"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Token erstellen unter{" "}
              <a
                href="https://replicate.com/account/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                replicate.com/account/api-tokens
              </a>
              . Guthaben von mindestens $5 aufladen, sonst gilt ein Limit von 6 Anfragen pro Minute.
              Der Token wird für Bild-Upscaling (~$0.012/Bild) und Hintergrund-Entfernung (~$0.04/Bild) verwendet.
            </p>
          </div>

          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={pending} className="gap-2">
            <Save className="h-4 w-4" />
            {pending ? "Speichere…" : "Speichern"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
