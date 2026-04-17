"use client";

import { useActionState, useRef, useEffect } from "react";
import { changeOwnPassword, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

const initial: ActionState = { error: null };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPassword, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4 max-w-sm">
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.success && (
        <Alert className="border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Passwort erfolgreich geaendert.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Neues Passwort</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          placeholder="Mindestens 8 Zeichen"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Neues Passwort bestaetigen</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Passwort aendern
      </Button>
    </form>
  );
}
