"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Euro } from "lucide-react";
import {
  addPreis,
  deletePreis,
  type AddPreisInput,
  type PreisRow,
  type PreisSpur,
} from "../preise-actions";

const SPUR_LABELS: Record<PreisSpur, string> = {
  lichtengros: "Lichtengros",
  eisenkeil: "Eisenkeil",
  listenpreis: "Listenpreis",
};

const SPUR_ORDER: PreisSpur[] = ["lichtengros", "eisenkeil", "listenpreis"];

type Props = {
  produktId: string;
  preise: PreisRow[];
};

type ZeileStatus = "aktuell" | "geplant" | "historie";

function getStatus(gueltig_ab: string, isAktuellInSpur: boolean, today: string): ZeileStatus {
  if (gueltig_ab > today) return "geplant";
  if (isAktuellInSpur) return "aktuell";
  return "historie";
}

function formatPreis(v: number): string {
  return `${v.toFixed(2).replace(".", ",")} €`;
}

export function PreiseSection({ produktId, preise }: Props) {
  const [list, setList] = useState<PreisRow[]>(preise);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaultSpur, setDialogDefaultSpur] = useState<PreisSpur>("listenpreis");
  const [deleteTarget, setDeleteTarget] = useState<PreisRow | null>(null);
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);

  const grouped = useMemo(() => {
    const byspur: Record<PreisSpur, PreisRow[]> = {
      lichtengros: [],
      eisenkeil: [],
      listenpreis: [],
    };
    for (const p of list) byspur[p.spur].push(p);
    for (const spur of SPUR_ORDER) {
      byspur[spur].sort((a, b) => {
        if (a.gueltig_ab !== b.gueltig_ab) return b.gueltig_ab.localeCompare(a.gueltig_ab);
        return b.created_at.localeCompare(a.created_at);
      });
    }
    return byspur;
  }, [list]);

  const aktuellerPreisIdProSpur = useMemo(() => {
    const result: Record<PreisSpur, string | null> = {
      lichtengros: null,
      eisenkeil: null,
      listenpreis: null,
    };
    for (const spur of SPUR_ORDER) {
      const kandidaten = grouped[spur].filter((p) => p.gueltig_ab <= today);
      result[spur] = kandidaten[0]?.id ?? null;
    }
    return result;
  }, [grouped, today]);

  function openAddDialog(spur: PreisSpur) {
    setDialogDefaultSpur(spur);
    setDialogOpen(true);
  }

  function handleAdd(input: AddPreisInput) {
    startTransition(async () => {
      const r = await addPreis(produktId, input);
      if (r.error || !r.preis) {
        toast.error(r.error ?? "Fehler beim Speichern");
        return;
      }
      setList((prev) => [r.preis!, ...prev]);
      setDialogOpen(false);
      toast.success("Preis hinzugefügt");
    });
  }

  function handleDelete(row: PreisRow) {
    startTransition(async () => {
      const r = await deletePreis(row.id, produktId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setList((prev) => prev.filter((p) => p.id !== row.id));
      setDeleteTarget(null);
      toast.success("Preis gelöscht");
    });
  }

  return (
    <section id="section-prices" className="glass-card">
      <div className="card-head">
        <div className="card-head-icon">
          <Euro />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="card-head-title">Preise</span>
            <span className="font-mono text-[11px] text-white/60">
              {list.length} {list.length === 1 ? "Eintrag" : "Einträge"}
            </span>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setDialogDefaultSpur("listenpreis")}>
              <Plus className="h-3.5 w-3.5" /> Neuer Preis
            </Button>
          </DialogTrigger>
          <PreisDialog
            defaultSpur={dialogDefaultSpur}
            onSubmit={handleAdd}
            pending={pending}
          />
        </Dialog>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-3">
        {SPUR_ORDER.map((spur) => {
          const aktuellId = aktuellerPreisIdProSpur[spur];
          const aktuellPreis = aktuellId
            ? grouped[spur].find((p) => p.id === aktuellId) ?? null
            : null;
          return (
            <div
              key={spur}
              className="rounded-[14px] border border-border/60 bg-card/40 p-4"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {SPUR_LABELS[spur]}
              </div>
              {aktuellPreis ? (
                <>
                  <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                    {formatPreis(Number(aktuellPreis.preis))}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    gültig ab {aktuellPreis.gueltig_ab}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-muted-foreground/60">
                    —
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7"
                    onClick={() => openAddDialog(spur)}
                  >
                    <Plus className="h-3 w-3" /> Preis anlegen
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-4 px-4 pb-4">
        {SPUR_ORDER.map((spur) => {
          const zeilen = grouped[spur];
          const aktuellId = aktuellerPreisIdProSpur[spur];
          return (
            <div key={spur} className="overflow-hidden rounded-[10px] border border-border/60">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                  {SPUR_LABELS[spur]}
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {zeilen.length} {zeilen.length === 1 ? "Eintrag" : "Einträge"}
                </span>
              </div>
              {zeilen.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Noch kein Preis hinterlegt.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                        Gültig ab
                      </TableHead>
                      <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                        Preis
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                        Status
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                        Quelle
                      </TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zeilen.map((p) => {
                      const status = getStatus(p.gueltig_ab, p.id === aktuellId, today);
                      return (
                        <TableRow
                          key={p.id}
                          className={status === "aktuell" ? "bg-[hsl(var(--green))]/10" : undefined}
                        >
                          <TableCell className="pl-4 font-mono text-[13px] tabular-nums">
                            {p.gueltig_ab}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold tabular-nums">
                            {formatPreis(Number(p.preis))}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={status} />
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">
                            {p.quelle}
                          </TableCell>
                          <TableCell className="pr-2 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteTarget(p)}
                              disabled={pending}
                              aria-label="Preis löschen"
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preis löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  {SPUR_LABELS[deleteTarget.spur]} vom {deleteTarget.gueltig_ab} (
                  {formatPreis(Number(deleteTarget.preis))}) wird unwiderruflich entfernt.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={pending}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function StatusBadge({ status }: { status: ZeileStatus }) {
  if (status === "aktuell") {
    return (
      <Badge variant="outline" className="border-[hsl(var(--green))]/40 bg-[hsl(var(--green))]/10 text-[hsl(var(--green))]">
        aktuell
      </Badge>
    );
  }
  if (status === "geplant") {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600">
        geplant
      </Badge>
    );
  }
  return <Badge variant="secondary">historie</Badge>;
}

function PreisDialog({
  defaultSpur,
  onSubmit,
  pending,
}: {
  defaultSpur: PreisSpur;
  onSubmit: (input: AddPreisInput) => void;
  pending: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [spur, setSpur] = useState<PreisSpur>(defaultSpur);
  const [gueltigAb, setGueltigAb] = useState(today);
  const [preis, setPreis] = useState("");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Neuer Preis</DialogTitle>
        <DialogDescription>
          Neuer Eintrag für eine der drei Preis-Spuren. Vorherige Einträge bleiben als Historie
          erhalten.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="spur">Spur</Label>
          <Select value={spur} onValueChange={(v) => setSpur(v as PreisSpur)}>
            <SelectTrigger id="spur">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPUR_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {SPUR_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gueltig_ab">Gültig ab</Label>
          <Input
            id="gueltig_ab"
            type="date"
            value={gueltigAb}
            onChange={(e) => setGueltigAb(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="preis">Preis (€)</Label>
          <Input
            id="preis"
            type="number"
            step="0.01"
            min="0"
            value={preis}
            onChange={(e) => setPreis(e.target.value)}
            placeholder="0,00"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !preis}
          onClick={() =>
            onSubmit({
              spur,
              gueltig_ab: gueltigAb,
              preis: Number(preis),
            })
          }
        >
          Speichern
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
