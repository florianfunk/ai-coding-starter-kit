"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { InlineEdit } from "@/components/inline-edit";
import {
  ChevronRight,
  Box,
  Loader2,
  CheckCircle,
  Circle,
  Trash2,
  X,
  FolderOpen,
} from "lucide-react";
import { quickUpdateProdukt, bulkUpdateProdukte } from "./actions";
import { toast } from "sonner";
import { CompletenessBar } from "@/components/completeness-bar";
import type { CompletenessResult } from "@/lib/completeness";

interface Produkt {
  id: string;
  artikelnummer: string;
  name: string | null;
  bereich_id: string;
  kategorie_id: string;
  sortierung: number;
  artikel_bearbeitet: boolean;
}

interface Kategorie {
  id: string;
  name: string;
}

interface ProdukteTableProps {
  produkte: Produkt[];
  bereichName: Record<string, string>;
  kategorieName: Record<string, string>;
  kategorien: Kategorie[];
  hasFilter: boolean;
  completenessMap: Record<string, CompletenessResult>;
}

export function ProdukteTable({
  produkte,
  bereichName,
  kategorieName,
  kategorien,
  hasFilter,
  completenessMap,
}: ProdukteTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();

  const allIds = produkte.map((p) => p.id);
  const allSelected = produkte.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = allIds.some((id) => selected.has(id)) && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleBulkAction(action: string, value?: string) {
    const ids = Array.from(selected);
    startBulkTransition(async () => {
      const result = await bulkUpdateProdukte(ids, action, value);
      if (result.error) {
        toast.error(`Fehler: ${result.error}`);
      } else {
        const labels: Record<string, string> = {
          mark_done: "als bearbeitet markiert",
          mark_undone: "als unbearbeitet markiert",
          change_kategorie: "Kategorie geaendert",
          delete: "geloescht",
        };
        toast.success(`${result.count} Produkte ${labels[action] ?? "aktualisiert"}`);
        clearSelection();
      }
    });
  }

  function handleBulkDelete() {
    setShowDeleteDialog(true);
  }

  function confirmBulkDelete() {
    setShowDeleteDialog(false);
    handleBulkAction("delete");
  }

  const selectedCount = selected.size;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
            <TableHead className="w-8 text-primary-foreground">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Alle Produkte auswaehlen"
                className="border-primary-foreground/50 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary data-[state=indeterminate]:bg-primary-foreground data-[state=indeterminate]:text-primary"
              />
            </TableHead>
            <TableHead className="text-primary-foreground font-semibold">Artikelnummer</TableHead>
            <TableHead className="text-primary-foreground font-semibold">Name</TableHead>
            <TableHead className="text-primary-foreground font-semibold">Bereich</TableHead>
            <TableHead className="text-primary-foreground font-semibold">Kategorie</TableHead>
            <TableHead className="text-right text-primary-foreground font-semibold">Sort</TableHead>
            <TableHead className="text-primary-foreground font-semibold">Status</TableHead>
            <TableHead className="text-primary-foreground font-semibold min-w-[140px]">Vollstaendigkeit</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        {produkte.length === 0 ? (
          <TableBody>
            <TableRow>
              <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                <Box className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-lg font-semibold text-foreground mb-1">
                  {hasFilter ? "Keine Treffer" : "Keine Produkte"}
                </p>
                <p className="text-sm">
                  {hasFilter
                    ? "Es wurden keine Produkte gefunden, die Ihrem Filter entsprechen."
                    : "Legen Sie Ihr erstes Produkt an, um loszulegen."}
                </p>
              </TableCell>
            </TableRow>
          </TableBody>
        ) : (
          <TableBody>
            {produkte.map((p) => (
              <ProduktRow
                key={p.id}
                produkt={p}
                bereich={bereichName[p.bereich_id] ?? "\u2014"}
                kategorie={kategorieName[p.kategorie_id] ?? "\u2014"}
                completeness={completenessMap[p.id]}
                isSelected={selected.has(p.id)}
                onToggle={() => toggleOne(p.id)}
              />
            ))}
          </TableBody>
        )}
      </Table>

      {/* Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
          <div className="mx-auto flex items-center justify-between gap-3 px-4 py-3 max-w-screen-2xl">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold whitespace-nowrap">
                {selectedCount} {selectedCount === 1 ? "Produkt" : "Produkte"} ausgewaehlt
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

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction("mark_done")}
                disabled={isBulkPending}
              >
                {isBulkPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-1" />
                )}
                Als bearbeitet markieren
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction("mark_undone")}
                disabled={isBulkPending}
              >
                {isBulkPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 mr-1" />
                )}
                Als unbearbeitet markieren
              </Button>

              <BulkKategorieSelect
                kategorien={kategorien}
                disabled={isBulkPending}
                onSelect={(kategorieId) => handleBulkAction("change_kategorie", kategorieId)}
              />

              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isBulkPending}
                className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                {isBulkPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Loeschen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Produkte loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCount} {selectedCount === 1 ? "Produkt" : "Produkte"} und alle zugehoerigen
              Preise werden unwiderruflich geloescht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Spacer so table content is not hidden by bulk bar */}
      {selectedCount > 0 && <div className="h-20" />}
    </>
  );
}

function BulkKategorieSelect({
  kategorien,
  disabled,
  onSelect,
}: {
  kategorien: Kategorie[];
  disabled: boolean;
  onSelect: (kategorieId: string) => void;
}) {
  return (
    <Select onValueChange={onSelect} disabled={disabled}>
      <SelectTrigger className="h-8 w-auto gap-1 text-sm border-input">
        <FolderOpen className="h-4 w-4 mr-1" />
        <SelectValue placeholder="Kategorie aendern" />
      </SelectTrigger>
      <SelectContent>
        {kategorien.map((k) => (
          <SelectItem key={k.id} value={k.id}>
            {k.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Keep the old export name for backwards compatibility during transition
export { ProdukteTable as ProdukteTableBody };

function ProduktRow({
  produkt,
  bereich,
  kategorie,
  completeness,
  isSelected,
  onToggle,
}: {
  produkt: Produkt;
  bereich: string;
  kategorie: string;
  completeness?: CompletenessResult;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const [p, setP] = useState(produkt);
  const [isPending, startTransition] = useTransition();

  const [prevProdukt, setPrevProdukt] = useState(produkt);
  if (produkt !== prevProdukt) {
    setPrevProdukt(produkt);
    setP(produkt);
  }

  async function handleQuickUpdate(
    field: string,
    value: string | number | boolean,
    label: string,
  ) {
    const oldValue = p[field as keyof typeof p];

    setP((prev) => ({ ...prev, [field]: value }));

    startTransition(async () => {
      const result = await quickUpdateProdukt(p.id, field, value);
      if (result.error) {
        setP((prev) => ({ ...prev, [field]: oldValue }));
        toast.error(`Fehler: ${result.error}`);
      } else {
        toast.success(`${label} gespeichert`);
      }
    });
  }

  return (
    <TableRow className={`group relative row-hover ${isSelected ? "bg-primary/5" : ""}`}>
      {/* Checkbox */}
      <TableCell className="relative z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          aria-label={`Produkt ${p.artikelnummer} auswaehlen`}
          className="pointer-events-auto"
        />
      </TableCell>

      {/* Artikelnummer */}
      <TableCell>
        <Link href={`/produkte/${p.id}`} className="absolute inset-0 z-0" />
        <span className="relative z-10 pointer-events-none font-mono text-sm group-hover:text-primary transition-colors">
          {p.artikelnummer}
        </span>
      </TableCell>

      {/* Name */}
      <TableCell className="max-w-md relative z-10">
        <span className="pointer-events-auto">
          <InlineEdit
            value={p.name ?? ""}
            type="text"
            onSave={async (v) => {
              await handleQuickUpdate("name", v || "", "Name");
            }}
          />
        </span>
      </TableCell>

      {/* Bereich */}
      <TableCell className="text-muted-foreground text-sm relative z-10 pointer-events-none">
        {bereich}
      </TableCell>

      {/* Kategorie */}
      <TableCell className="text-muted-foreground text-sm relative z-10 pointer-events-none">
        {kategorie}
      </TableCell>

      {/* Sortierung */}
      <TableCell className="text-right relative z-10">
        <span className="pointer-events-auto">
          <InlineEdit
            value={p.sortierung}
            type="number"
            onSave={async (v) => {
              const num = Number(v);
              if (!Number.isFinite(num) || num < 0) {
                toast.error("Bitte eine gueltige Zahl eingeben");
                throw new Error("invalid");
              }
              await handleQuickUpdate("sortierung", num, "Sortierung");
            }}
          />
        </span>
      </TableCell>

      {/* Status */}
      <TableCell className="relative z-10">
        <button
          type="button"
          onClick={() =>
            handleQuickUpdate(
              "artikel_bearbeitet",
              !p.artikel_bearbeitet,
              "Status",
            )
          }
          disabled={isPending}
          className="pointer-events-auto cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : p.artikel_bearbeitet ? (
            <Badge className="bg-success text-success-foreground hover:bg-success/80 text-[10px] transition-colors">
              bearbeitet
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
            >
              unbearbeitet
            </Badge>
          )}
        </button>
      </TableCell>

      {/* Vollstaendigkeit */}
      <TableCell className="relative z-10">
        {completeness && (
          <span className="pointer-events-auto">
            <CompletenessBar result={completeness} />
          </span>
        )}
      </TableCell>

      {/* Arrow */}
      <TableCell className="relative z-20">
        <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </TableCell>
    </TableRow>
  );
}
