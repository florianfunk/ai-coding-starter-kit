"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createUser, type ActionState } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Loader2, AlertCircle } from "lucide-react";

const initial: ActionState = { error: null };

export function CreateUserDialog() {
  const [state, formAction, pending] = useActionState(createUser, initial);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Close dialog on success (redirect handles this, but as safety)
  useEffect(() => {
    if (state.success) {
      setOpen(false);
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Plus className="mr-2 h-4 w-4" /> Neuer Benutzer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Benutzer anlegen</DialogTitle>
          <DialogDescription>
            Der Benutzer kann sich nach dem Erstellen sofort anmelden.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="space-y-4">
          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="create-email">E-Mail-Adresse</Label>
            <Input
              id="create-email"
              name="email"
              type="email"
              placeholder="name@beispiel.de"
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-password">Passwort</Label>
            <Input
              id="create-password"
              name="password"
              type="password"
              placeholder="Mindestens 8 Zeichen"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
