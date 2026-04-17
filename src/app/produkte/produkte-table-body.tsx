"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InlineEdit } from "@/components/inline-edit";
import { ChevronRight, Package, Box, Loader2 } from "lucide-react";
import { quickUpdateProdukt } from "./actions";
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

interface ProdukteTableBodyProps {
  produkte: Produkt[];
  bereichName: Record<string, string>;
  kategorieName: Record<string, string>;
  hasFilter: boolean;
  completenessMap: Record<string, CompletenessResult>;
}

export function ProdukteTableBody({
  produkte,
  bereichName,
  kategorieName,
  hasFilter,
  completenessMap,
}: ProdukteTableBodyProps) {
  if (produkte.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={8} className="py-16 text-center text-muted-foreground">
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
    );
  }

  return (
    <TableBody>
      {produkte.map((p) => (
        <ProduktRow
          key={p.id}
          produkt={p}
          bereich={bereichName[p.bereich_id] ?? "\u2014"}
          kategorie={kategorieName[p.kategorie_id] ?? "\u2014"}
          completeness={completenessMap[p.id]}
        />
      ))}
    </TableBody>
  );
}

function ProduktRow({
  produkt,
  bereich,
  kategorie,
  completeness,
}: {
  produkt: Produkt;
  bereich: string;
  kategorie: string;
  completeness?: CompletenessResult;
}) {
  const [p, setP] = useState(produkt);
  const [isPending, startTransition] = useTransition();

  // Keep in sync with server data when props change
  // (e.g. after revalidation)
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

    // Optimistic update
    setP((prev) => ({ ...prev, [field]: value }));

    startTransition(async () => {
      const result = await quickUpdateProdukt(p.id, field, value);
      if (result.error) {
        // Rollback
        setP((prev) => ({ ...prev, [field]: oldValue }));
        toast.error(`Fehler: ${result.error}`);
      } else {
        toast.success(`${label} gespeichert`);
      }
    });
  }

  return (
    <TableRow className="group relative row-hover">
      {/* Artikelnummer — link to detail */}
      <TableCell>
        <Link href={`/produkte/${p.id}`} className="absolute inset-0 z-0" />
        <span className="relative z-10 pointer-events-none font-mono text-sm group-hover:text-primary transition-colors">
          {p.artikelnummer}
        </span>
      </TableCell>

      {/* Name — inline editable */}
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

      {/* Sortierung — inline editable */}
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

      {/* Status — click to toggle */}
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
