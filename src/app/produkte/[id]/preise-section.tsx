"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { addPreis, deletePreis, type PreisInput } from "../preise-actions";

type Preis = {
  id: string; gueltig_ab: string; ek: number | null; listenpreis: number; status: "aktiv" | "inaktiv";
};

export function PreiseSection({ produktId, preise }: { produktId: string; preise: Preis[] }) {
  const [list, setList] = useState(preise);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  // determine current price (latest active with gueltig_ab <= today)
  const currentId = (() => {
    const candidates = list
      .filter((p) => p.status === "aktiv" && p.gueltig_ab <= today)
      .sort((a, b) => b.gueltig_ab.localeCompare(a.gueltig_ab));
    return candidates[0]?.id;
  })();

  function add(p: PreisInput) {
    startTransition(async () => {
      const r = await addPreis(produktId, p);
      if (r.error || !r.preis) { toast.error(r.error ?? "Fehler"); return; }
      setList((prev) => [r.preis!, ...prev.map((x) => (p.deactivateOthers && x.status === "aktiv" ? { ...x, status: "inaktiv" as const } : x))]);
      setShowForm(false);
      toast.success("Preis hinzugefügt");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deletePreis(id, produktId);
      if (r.error) toast.error(r.error);
      else { setList((prev) => prev.filter((p) => p.id !== id)); toast.success("Gelöscht"); }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Preise</CardTitle>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> {showForm ? "Abbrechen" : "neuer Preis"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && <PreisForm onSubmit={add} pending={pending} />}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gültig ab</TableHead>
              <TableHead className="text-right">EK</TableHead>
              <TableHead className="text-right">Listenpreis</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Noch keine Preise.</TableCell></TableRow>
            )}
            {list.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.gueltig_ab}</TableCell>
                <TableCell className="text-right">{p.ek != null ? `${p.ek.toFixed(2)} €` : "—"}</TableCell>
                <TableCell className="text-right font-medium">{p.listenpreis.toFixed(2)} €</TableCell>
                <TableCell>
                  {p.id === currentId
                    ? <Badge>aktuell</Badge>
                    : p.status === "aktiv" ? <Badge variant="secondary">aktiv</Badge> : <Badge variant="outline">inaktiv</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)} disabled={pending}>Löschen</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PreisForm({ onSubmit, pending }: { onSubmit: (p: PreisInput) => void; pending: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const [gueltigAb, setGueltigAb] = useState(today);
  const [ek, setEk] = useState("");
  const [lp, setLp] = useState("");
  const [deact, setDeact] = useState(true);

  return (
    <div className="rounded border p-3 grid grid-cols-5 gap-3 items-end bg-muted/30">
      <div>
        <Label htmlFor="gueltig_ab">Gültig ab</Label>
        <Input id="gueltig_ab" type="date" value={gueltigAb} onChange={(e) => setGueltigAb(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="ek">EK (€)</Label>
        <Input id="ek" type="number" step="0.01" value={ek} onChange={(e) => setEk(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="lp">Listenpreis (€) *</Label>
        <Input id="lp" type="number" step="0.01" required value={lp} onChange={(e) => setLp(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm pt-6">
        <input type="checkbox" checked={deact} onChange={(e) => setDeact(e.target.checked)} />
        alte deaktivieren
      </label>
      <Button
        disabled={pending || !lp}
        onClick={() => onSubmit({
          gueltig_ab: gueltigAb,
          ek: ek ? Number(ek) : null,
          listenpreis: Number(lp),
          deactivateOthers: deact,
        })}
      >Speichern</Button>
    </div>
  );
}
