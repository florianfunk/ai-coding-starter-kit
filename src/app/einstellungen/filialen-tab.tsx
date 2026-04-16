"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createFiliale, deleteFiliale, updateFiliale, type FilialeFormState } from "./actions";

type Filiale = { id: string; marke: "lichtengros" | "eisenkeil"; name: string; land: string | null; adresse: string | null; telefon: string | null; fax: string | null; email: string | null; sortierung: number };

const initial: FilialeFormState = { error: null };

export function FilialenTab({ filialen }: { filialen: Filiale[] }) {
  const [editing, setEditing] = useState<Filiale | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteFiliale(id);
      if (r.error) toast.error(r.error); else toast.success("Gelöscht");
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Filialen ({filialen.length})</CardTitle>
        <Button size="sm" onClick={() => { setShowNew(true); setEditing(null); }}>+ neu</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showNew && <FilialeForm action={createFiliale} onDone={() => setShowNew(false)} submitLabel="Anlegen" />}
        {editing && <FilialeForm
          action={async (p, fd) => updateFiliale(editing.id, p, fd)}
          defaultValues={editing}
          onDone={() => setEditing(null)}
          submitLabel="Speichern"
        />}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marke</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Land</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead className="w-32 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filialen.map((f) => (
              <TableRow key={f.id}>
                <TableCell><Badge variant="outline">{f.marke}</Badge></TableCell>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell>{f.land ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-pre-line max-w-xs truncate">{f.adresse ?? "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(f); setShowNew(false); }}>Bearbeiten</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(f.id)} disabled={pending}>Löschen</Button>
                </TableCell>
              </TableRow>
            ))}
            {filialen.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Keine Filialen.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FilialeForm({
  action, defaultValues, onDone, submitLabel,
}: {
  action: (prev: FilialeFormState, fd: FormData) => Promise<FilialeFormState>;
  defaultValues?: Partial<Filiale>; onDone: () => void; submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  if (state.error === null && !pending && (state as any) !== initial) {
    // success — close form
    setTimeout(onDone, 0);
  }

  return (
    <form action={formAction} className="rounded border p-3 grid grid-cols-2 gap-3 bg-muted/30">
      <div>
        <Label htmlFor="marke">Marke *</Label>
        <select id="marke" name="marke" defaultValue={defaultValues?.marke ?? "lichtengros"} className="w-full rounded border px-2 py-2 bg-background">
          <option value="lichtengros">lichtengros</option>
          <option value="eisenkeil">eisenkeil</option>
        </select>
      </div>
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input id="name" name="name" required defaultValue={defaultValues?.name ?? ""} />
      </div>
      <div>
        <Label htmlFor="land">Land</Label>
        <Input id="land" name="land" defaultValue={defaultValues?.land ?? ""} />
      </div>
      <div>
        <Label htmlFor="sortierung">Sortierung</Label>
        <Input id="sortierung" name="sortierung" type="number" defaultValue={String(defaultValues?.sortierung ?? 0)} />
      </div>
      <div className="col-span-2">
        <Label htmlFor="adresse">Adresse</Label>
        <Textarea id="adresse" name="adresse" rows={3} defaultValue={defaultValues?.adresse ?? ""} />
      </div>
      <div><Label htmlFor="telefon">Telefon</Label><Input id="telefon" name="telefon" defaultValue={defaultValues?.telefon ?? ""} /></div>
      <div><Label htmlFor="fax">Fax</Label><Input id="fax" name="fax" defaultValue={defaultValues?.fax ?? ""} /></div>
      <div className="col-span-2"><Label htmlFor="email">E-Mail</Label><Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} /></div>
      <div className="col-span-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>Abbrechen</Button>
        <Button type="submit" disabled={pending}>{pending ? "Speichere…" : submitLabel}</Button>
      </div>
    </form>
  );
}
