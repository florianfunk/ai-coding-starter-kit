"use client";

import { useActionState } from "react";
import { Lightbulb } from "lucide-react";
import { setNewPasswordAction, type AuthState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initial: AuthState = { error: null };

export default function ConfirmResetPage() {
  const [state, formAction, pending] = useActionState(setNewPasswordAction, initial);

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
          <h2 className="mb-1 text-xl font-bold tracking-tight">Neues Passwort setzen</h2>
          <p className="mb-5 text-sm text-muted-foreground">Mindestens 8 Zeichen.</p>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Neues Passwort</Label>
              <Input id="password" name="password" type="password" required disabled={pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Bestätigen</Label>
              <Input id="confirm" name="confirm" type="password" required disabled={pending} />
            </div>
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Speichere…" : "Passwort setzen"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
