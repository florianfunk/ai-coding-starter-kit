"use client";

// PROJ-9: Drill-down-Sheet — von einer EÜR-Kategoriesumme auf die
// einzelnen Buchungen. Lückenlose Nachvollziehbarkeit (Summe → Buchung).

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BuchungsZeile {
  id: string;
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
}

export interface DrilldownGruppe {
  bezeichnung: string;
  typ: "einnahme" | "ausgabe";
  euer_zeile: string | null;
  summe: number;
  buchungen: BuchungsZeile[];
}

function euro(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function formatDatum(iso: string): string {
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function EuerDrilldownSheet({
  gruppe,
  open,
  onOpenChange,
}: {
  gruppe: DrilldownGruppe | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{gruppe?.bezeichnung ?? "Position"}</SheetTitle>
          <SheetDescription>
            {gruppe ? (
              <span className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    gruppe.typ === "einnahme" ? "default" : "secondary"
                  }
                >
                  {gruppe.typ === "einnahme"
                    ? "Betriebseinnahme"
                    : "Betriebsausgabe"}
                </Badge>
                {gruppe.euer_zeile ? (
                  <Badge variant="outline">
                    EÜR-Zeile {gruppe.euer_zeile}
                  </Badge>
                ) : null}
                <span className="text-sm">
                  Summe: <strong>{euro(gruppe.summe)}</strong> (
                  {gruppe.buchungen.length} Buchung(en))
                </span>
              </span>
            ) : (
              "Keine Auswahl."
            )}
          </SheetDescription>
        </SheetHeader>

        {gruppe ? (
          <ScrollArea className="mt-4 h-[calc(100vh-9rem)] pr-4">
            {gruppe.buchungen.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Buchungen in dieser Position.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Datum</TableHead>
                    <TableHead>Zweck / Empfänger</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gruppe.buchungen.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {formatDatum(b.buchung_datum)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="max-w-[260px] truncate">
                          {b.verwendungszweck ?? "—"}
                        </div>
                        {b.empfaenger ? (
                          <div className="max-w-[260px] truncate text-xs text-muted-foreground">
                            {b.empfaenger}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          b.betrag < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {euro(b.betrag)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
