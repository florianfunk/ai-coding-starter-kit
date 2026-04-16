"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateKatalogEinstellungen, type FilialeFormState } from "./actions";

const initial: FilialeFormState = { error: null };

export function KatalogTab({ settings }: { settings: any }) {
  const [state, formAction, pending] = useActionState(updateKatalogEinstellungen, initial);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state !== initial && !pending) toast.success("Gespeichert");
  }, [state, pending]);

  return (
    <Card>
      <CardHeader><CardTitle>Katalog-Parameter</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4 max-w-3xl">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="gueltig_bis">Gültig bis</Label>
              <Input id="gueltig_bis" name="gueltig_bis" type="date" defaultValue={settings?.gueltig_bis ?? ""} />
            </div>
            <div>
              <Label htmlFor="wechselkurs_eur_chf">Wechselkurs EUR → CHF</Label>
              <Input id="wechselkurs_eur_chf" name="wechselkurs_eur_chf" type="number" step="0.0001" defaultValue={settings?.wechselkurs_eur_chf ?? 1} />
            </div>
          </div>
          <div>
            <Label htmlFor="copyright_lichtengros">Copyright Lichtengros</Label>
            <Textarea id="copyright_lichtengros" name="copyright_lichtengros" rows={5} defaultValue={settings?.copyright_lichtengros ?? ""} />
          </div>
          <div>
            <Label htmlFor="copyright_eisenkeil">Copyright Eisenkeil</Label>
            <Textarea id="copyright_eisenkeil" name="copyright_eisenkeil" rows={5} defaultValue={settings?.copyright_eisenkeil ?? ""} />
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Speichere…" : "Speichern"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
