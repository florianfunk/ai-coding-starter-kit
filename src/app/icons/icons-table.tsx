"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil } from "lucide-react";
import { DeleteIconButton } from "./delete-button";
import { bulkSetShowAsSymbol } from "./actions";

type IconRow = {
  id: string;
  label: string;
  gruppe: string | null;
  sortierung: number;
  url: string | null;
  show_as_symbol: boolean;
};

export function IconsTable({ icons }: { icons: IconRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allIds = useMemo(() => icons.map((i) => i.id), [icons]);
  const allSelected = selected.size > 0 && selected.size === icons.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll(v: boolean) {
    setSelected(v ? new Set(allIds) : new Set());
  }

  function toggleOne(id: string, v: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function applyBulk(value: boolean) {
    const ids = [...selected];
    if (!ids.length) return;
    startTransition(async () => {
      const r = await bulkSetShowAsSymbol(ids, value);
      if (r.error) toast.error(r.error);
      else {
        toast.success(
          `${r.updated} Icon${r.updated === 1 ? "" : "s"} ${value ? "als Symbol markiert" : "Markierung entfernt"}`,
        );
        setSelected(new Set());
      }
    });
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-[10px] border border-primary/20 bg-primary/5 px-4 py-2.5">
          <span className="text-[13px] text-foreground/80">
            <strong className="font-semibold">{selected.size}</strong> ausgewählt
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => applyBulk(true)}
            >
              Als Symbol markieren
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => applyBulk(false)}
            >
              Markierung entfernen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setSelected(new Set())}
            >
              Auswahl aufheben
            </Button>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-5">
                <Checkbox
                  aria-label="Alle auswählen"
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAll(Boolean(v))}
                />
              </TableHead>
              <TableHead className="w-12 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                #
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                Name
              </TableHead>
              <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                Gruppe
              </TableHead>
              <TableHead className="w-24 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                Sortierung
              </TableHead>
              <TableHead className="w-24 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                Bild
              </TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {icons.map((ic, i) => (
              <TableRow key={ic.id} className="group border-border/60">
                <TableCell className="pl-5">
                  <Checkbox
                    aria-label={`${ic.label} auswählen`}
                    checked={selected.has(ic.id)}
                    onCheckedChange={(v) => toggleOne(ic.id, Boolean(v))}
                  />
                </TableCell>
                <TableCell className="font-mono text-[11.5px] text-muted-foreground/70 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{ic.label}</span>
                    {ic.show_as_symbol && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-primary">
                        Symbol
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {ic.gruppe ? (
                    <span className="text-sm text-muted-foreground">{ic.gruppe}</span>
                  ) : (
                    <span className="text-xs italic text-muted-foreground/50">ohne Gruppe</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-[12.5px] tabular-nums text-muted-foreground">
                  {ic.sortierung}
                </TableCell>
                <TableCell>
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-[10px] border border-border/60 bg-muted">
                    {ic.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ic.url} alt={ic.label} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">
                        {ic.label.slice(0, 4)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/icons/${ic.id}`}>
                        <Pencil className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Bearbeiten</span>
                      </Link>
                    </Button>
                    <DeleteIconButton id={ic.id} name={ic.label} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
