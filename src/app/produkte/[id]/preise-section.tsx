"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Euro } from "lucide-react";
import { addPreis, deletePreis, type PreisInput } from "../preise-actions";

type Preis = {
  id: string; gueltig_ab: string; ek: number | null; ek_eisenkeil: number | null; listenpreis: number; status: "aktiv" | "inaktiv";
};

export function PreiseSection({ produktId, preise }: { produktId: string; preise: Preis[] }) {
  const [list, setList] = useState(preise);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const currentId = (() => {
    const c = list.filter((p) => p.status === "aktiv" && p.gueltig_ab <= today)
      .sort((a, b) => b.gueltig_ab.localeCompare(a.gueltig_ab));
    return c[0]?.id;
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

  const fmt = (v: number | null) => v != null ? `${v.toFixed(2)} €` : "—";

  return (
    <section id="section-prices" className="glass-card">
      <div className="card-head">
        <div className="card-head-icon"><Euro /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="card-head-title">Preise</span>
            <span className="font-mono text-[11px] text-white/60">
              {list.length} {list.length === 1 ? "Eintrag" : "Einträge"}
            </span>
          </div>
          {currentId && (
            <div className="card-head-sub">
              Aktueller Listenpreis: {fmt(list.find((p) => p.id === currentId)?.listenpreis ?? null)}
            </div>
          )}
        </div>
        <Button size="sm" variant={showForm ? "outline" : "default"} onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> {showForm ? "Abbrechen" : "Neuer Preis"}
        </Button>
      </div>
      <div className="space-y-3 p-4">
        {showForm && <PreisForm onSubmit={add} pending={pending} />}

        <div className="overflow-hidden rounded-[10px] border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Gültig ab</TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">EK Lichtengros</TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">EK Eisenkeil</TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Listenpreis</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Noch keine Preise.</TableCell></TableRow>
              )}
              {list.map((p) => (
                <TableRow key={p.id} className={p.id === currentId ? "bg-[hsl(var(--green))]/10" : ""}>
                  <TableCell className="pl-4 font-mono text-[13px] tabular-nums">{p.gueltig_ab}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmt(p.ek)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmt(p.ek_eisenkeil)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold tabular-nums">{fmt(p.listenpreis)}</TableCell>
                  <TableCell>
                    {p.id === currentId ? (
                      <span className="pill pill-ok">aktuell</span>
                    ) : p.status === "aktiv" ? (
                      <span className="pill">aktiv</span>
                    ) : (
                      <span className="pill">inaktiv</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)} disabled={pending}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}

function PreisForm({ onSubmit, pending }: { onSubmit: (p: PreisInput) => void; pending: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const [gueltigAb, setGueltigAb] = useState(today);
  const [ek, setEk] = useState("");
  const [ekEis, setEkEis] = useState("");
  const [lp, setLp] = useState("");
  const [deact, setDeact] = useState(true);

  return (
    <div className="space-y-4 rounded-[14px] border border-primary/20 bg-primary/5 p-4">
      <h4 className="font-semibold text-sm">Neuen Preis hinzufügen</h4>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <div>
          <Label className="text-xs">Gültig ab</Label>
          <Input type="date" value={gueltigAb} onChange={(e) => setGueltigAb(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">EK Lichtengros (€)</Label>
          <Input type="number" step="0.01" value={ek} onChange={(e) => setEk(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label className="text-xs">EK Eisenkeil (€)</Label>
          <Input type="number" step="0.01" value={ekEis} onChange={(e) => setEkEis(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label className="text-xs">Listenpreis (€) *</Label>
          <Input type="number" step="0.01" required value={lp} onChange={(e) => setLp(e.target.value)} placeholder="0.00" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={deact} onChange={(e) => setDeact(e.target.checked)} />
            alte deaktivieren
          </label>
          <Button
            disabled={pending || !lp}
            onClick={() => onSubmit({
              gueltig_ab: gueltigAb,
              ek: ek ? Number(ek) : null,
              ek_eisenkeil: ekEis ? Number(ekEis) : null,
              listenpreis: Number(lp),
              deactivateOthers: deact,
            })}
          >Speichern</Button>
        </div>
      </div>
    </div>
  );
}
