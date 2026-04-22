"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Scale,
  ImageIcon,
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
  hauptbild_path?: string | null;
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

const MAX_COMPARE = 3;

export function ProdukteTable({
  produkte,
  bereichName,
  kategorieName,
  kategorien,
  hasFilter,
  completenessMap,
}: ProdukteTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX_COMPARE) {
        toast.error(`Maximal ${MAX_COMPARE} Produkte zum Vergleich`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function removeFromCompare(id: string) {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  }

  function navigateToCompare() {
    if (compareIds.length >= 2) {
      router.push(`/produkte/vergleich?ids=${compareIds.join(",")}`);
    }
  }

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
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8 pl-5">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Alle Produkte auswählen"
              />
            </TableHead>
            <TableHead className="w-[72px] text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Bild
            </TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Artikelnummer
            </TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Name
            </TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Bereich
            </TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Kategorie
            </TableHead>
            <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Sort
            </TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Status
            </TableHead>
            <TableHead className="min-w-[140px] text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Vollständigkeit
            </TableHead>
            <TableHead className="w-10" />
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        {produkte.length === 0 ? (
          <TableBody>
            <TableRow>
              <TableCell colSpan={11} className="py-16 text-center text-muted-foreground">
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
                isComparing={compareIds.includes(p.id)}
                onToggleCompare={() => toggleCompare(p.id)}
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

      {/* Compare Bar — only when no bulk selection is active */}
      {selectedCount === 0 && compareIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-accent bg-accent/10 backdrop-blur supports-[backdrop-filter]:bg-accent/5 shadow-lg">
          <div className="mx-auto flex items-center justify-between gap-3 px-4 py-3 max-w-screen-2xl">
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-accent-foreground shrink-0" />
              <span className="text-sm font-semibold whitespace-nowrap">
                {compareIds.length} von {MAX_COMPARE} zum Vergleich
              </span>
              <div className="flex items-center gap-2 overflow-x-auto">
                {compareIds.map((cid) => {
                  const prod = produkte.find((p) => p.id === cid);
                  return (
                    <Badge key={cid} variant="secondary" className="flex items-center gap-1 shrink-0 py-1 px-2">
                      <span className="text-xs font-mono">{prod?.artikelnummer ?? "..."}</span>
                      <span className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {prod?.name ?? ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCompare(cid)}
                        className="ml-1 hover:text-destructive transition-colors"
                        aria-label="Aus Vergleich entfernen"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCompareIds([])}
                className="text-muted-foreground hover:text-foreground"
              >
                Auswahl leeren
              </Button>
              <Button
                size="sm"
                onClick={navigateToCompare}
                disabled={compareIds.length < 2}
                className="shadow-sm"
              >
                <Scale className="h-4 w-4 mr-1" />
                Vergleichen
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

      {/* Spacer so table content is not hidden by bottom bars */}
      {(selectedCount > 0 || compareIds.length > 0) && <div className="h-20" />}
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
  isComparing,
  onToggleCompare,
}: {
  produkt: Produkt;
  bereich: string;
  kategorie: string;
  completeness?: CompletenessResult;
  isSelected: boolean;
  onToggle: () => void;
  isComparing: boolean;
  onToggleCompare: () => void;
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

      {/* Thumbnail */}
      <TableCell className="relative z-10 pointer-events-none">
        {p.hauptbild_path ? (
          <Image
            src={`/api/bild/produktbilder/${p.hauptbild_path}`}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded object-cover border"
          />
        ) : (
          <div className="h-14 w-14 rounded bg-muted flex items-center justify-center border">
            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
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
            <span className="pill pill-ok">bearbeitet</span>
          ) : (
            <span className="pill pill-bad">unbearbeitet</span>
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

      {/* Compare */}
      <TableCell className="relative z-10">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCompare}
                className={`pointer-events-auto p-1 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isComparing
                    ? "text-accent-foreground bg-accent"
                    : "text-muted-foreground/40 hover:text-accent-foreground hover:bg-accent/50"
                }`}
                aria-label={isComparing ? "Aus Vergleich entfernen" : "Zum Vergleich hinzufuegen"}
              >
                <Scale className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{isComparing ? "Aus Vergleich entfernen" : "Zum Vergleich hinzufuegen"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>

      {/* Arrow */}
      <TableCell className="relative z-20">
        <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </TableCell>
    </TableRow>
  );
}
