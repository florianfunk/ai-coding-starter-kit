"use client";

import { useActionState } from "react";
import { setNewPasswordAction, type AuthState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initial: AuthState = { error: null };

export default function ConfirmResetPage() {
  const [state, formAction, pending] = useActionState(setNewPasswordAction, initial);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Neues Passwort setzen</CardTitle>
          <CardDescription>Mindestens 8 Zeichen.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
