"use client";

import { useActionState } from "react";
import { Lightbulb } from "lucide-react";
import { requestPasswordResetAction, type AuthState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AuthState = { error: null };

export default function RequestResetPage() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initial);
  const submitted = !pending && state.error === null && state !== initial;

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="brand-logo grid h-12 w-12 place-items-center rounded-2xl text-white">
            <Lightbulb className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none tracking-[-0.01em]">Lichtengros</p>
            <p className="eyebrow mt-1 !text-[10px]">Produktverwaltung</p>
          </div>
        </div>
        <div className="glass-card p-6">
          <h2 className="mb-1 text-xl font-bold tracking-tight">Passwort zurücksetzen</h2>
          <p className="mb-5 text-sm text-muted-foreground">Wir senden dir einen Link per E-Mail.</p>
          {submitted ? (
            <p className="text-[13.5px]">
              Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link verschickt. Bitte
              prüfe dein Postfach.
            </p>
          ) : (
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" name="email" type="email" required disabled={pending} />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Sende Link…" : "Reset-Link anfordern"}
              </Button>
              <div className="text-center text-sm">
                <a href="/login" className="text-muted-foreground hover:underline">
                  Zurück zur Anmeldung
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
