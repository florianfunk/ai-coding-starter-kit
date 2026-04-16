"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type AuthState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initial: AuthState = { error: null };

export default function RequestResetPage() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initial);
  const submitted = !pending && state.error === null && state !== initial;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Passwort zurücksetzen</CardTitle>
          <CardDescription>Wir senden dir einen Link per E-Mail.</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <p className="text-sm">
              Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link verschickt.
              Bitte prüfe dein Postfach.
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
        </CardContent>
      </Card>
    </div>
  );
}
