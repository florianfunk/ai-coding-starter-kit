"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Package, Sparkles, X } from "lucide-react";
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
import { BulkNamenWizard } from "@/app/produkte/bulk-namen-wizard";

interface Produkt {
  id: string;
  artikelnummer: string;
  name: string | null;
  sortierung: number;
  artikel_bearbeitet: boolean;
  hauptbild_url: string | null;
}

interface PreisEntry {
  listenpreis: number | null;
  ekLG: number | null;
  ekEK: number | null;
}

interface Props {
  produkte: Produkt[];
  preisMap: Record<string, PreisEntry>;
}

export function ProdukteTabelle({ produkte, preisMap }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showWizard, setShowWizard] = useState(false);

  const allIds = produkte.map((p) => p.id);
  const allSelected = produkte.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = allIds.some((id) => selected.has(id)) && !allSelected;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const selectedCount = selected.size;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8 pl-5">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Alle Produkte auswählen"
              />
            </TableHead>
            <TableHead className="w-16 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Bild
            </TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Artikelnummer
            </TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Bezeichnung
            </TableHead>
            <TableHead className="w-24 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Sort
            </TableHead>
            <TableHead className="w-28 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Listenpreis
            </TableHead>
            <TableHead className="w-28 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              EK Lichtengros
            </TableHead>
            <TableHead className="w-28 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              EK Eisenkeil
            </TableHead>
            <TableHead className="w-28 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produkte.map((p) => {
            const isSelected = selected.has(p.id);
            const preis = preisMap[p.id];
            return (
              <TableRow
                key={p.id}
                className={`group relative border-border/60 ${isSelected ? "bg-primary/5" : ""}`}
              >
                <TableCell className="relative z-10 pl-5">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(p.id)}
                    aria-label={`Produkt ${p.artikelnummer} auswählen`}
                    className="pointer-events-auto"
                  />
                </TableCell>
                <TableCell className="pointer-events-none relative z-10">
                  {p.hauptbild_url ? (
                    <Image
                      src={p.hauptbild_url}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 rounded-[8px] border border-border/60 object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-[8px] border border-border/60 bg-muted">
                      <Package className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/produkte/${p.id}`} className="absolute inset-0 z-0" />
                  <span className="pointer-events-none relative z-10 font-mono text-[13px] transition-colors group-hover:text-primary">
                    {p.artikelnummer}
                  </span>
                </TableCell>
                <TableCell className="pointer-events-none relative z-10 max-w-md">
                  <div className="truncate">{p.name ?? "—"}</div>
                </TableCell>
                <TableCell className="pointer-events-none relative z-10 text-right font-mono tabular-nums text-muted-foreground">
                  {p.sortierung}
                </TableCell>
                <TableCell className="pointer-events-none relative z-10 text-right font-semibold tabular-nums">
                  {preis?.listenpreis != null ? (
                    <span className="text-primary">{preis.listenpreis.toFixed(2)} €</span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="pointer-events-none relative z-10 text-right font-mono tabular-nums text-muted-foreground">
                  {preis?.ekLG != null ? `${preis.ekLG.toFixed(2)} €` : "—"}
                </TableCell>
                <TableCell className="pointer-events-none relative z-10 text-right font-mono tabular-nums text-muted-foreground">
                  {preis?.ekEK != null ? `${preis.ekEK.toFixed(2)} €` : "—"}
                </TableCell>
                <TableCell className="pointer-events-none relative z-10">
                  {p.artikel_bearbeitet ? (
                    <span className="pill pill-ok">bearbeitet</span>
                  ) : (
                    <span className="pill pill-bad">unbearbeitet</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
          <div className="mx-auto flex items-center justify-between gap-3 px-4 py-3 max-w-screen-2xl">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold whitespace-nowrap">
                {selectedCount} {selectedCount === 1 ? "Produkt" : "Produkte"} ausgewählt
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Auswahl aufheben
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowWizard(true)}>
                <Sparkles className="h-4 w-4 mr-1" />
                KI-Vorschläge
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedCount > 0 && <div className="h-20" />}

      <BulkNamenWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        produkte={produkte
          .filter((p) => selected.has(p.id))
          .map((p) => ({ id: p.id, artikelnummer: p.artikelnummer, name: p.name }))}
        onApplied={() => {
          clearSelection();
          router.refresh();
        }}
      />
    </>
  );
}
