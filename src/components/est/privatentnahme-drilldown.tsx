"use client";

// PROJ-10: Drill-down-Sheet — von einer Monats-/Zeitraumsumme der
// Privatentnahmen auf die einzelnen privaten Buchungen.

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
import {
  formatDatum,
  formatEuro,
  formatProzent,
  type PrivatEntnahmeZeile,
} from "./typen";

export interface PrivatGruppe {
  titel: string;
  summe: number;
  zeilen: PrivatEntnahmeZeile[];
}

export function PrivatentnahmeDrilldown({
  gruppe,
  open,
  onOpenChange,
}: {
  gruppe: PrivatGruppe | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{gruppe?.titel ?? "Zeitraum"}</SheetTitle>
          <SheetDescription>
            {gruppe ? (
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Privatentnahmen</Badge>
                <span className="text-sm">
                  Summe: <strong>{formatEuro(gruppe.summe)}</strong> (
                  {gruppe.zeilen.length} Buchung(en))
                </span>
              </span>
            ) : (
              "Keine Auswahl."
            )}
          </SheetDescription>
        </SheetHeader>

        {gruppe ? (
          <ScrollArea className="mt-4 h-[calc(100vh-9rem)] pr-4">
            {gruppe.zeilen.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine privaten Buchungen in diesem Zeitraum.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Datum</TableHead>
                    <TableHead>Empfänger / Zweck</TableHead>
                    <TableHead>Konto</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gruppe.zeilen.map((z) => (
                    <TableRow key={z.id}>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {formatDatum(z.buchung_datum)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="max-w-[220px] truncate">
                          {z.empfaenger ?? "—"}
                        </div>
                        {z.verwendungszweck ? (
                          <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                            {z.verwendungszweck}
                          </div>
                        ) : null}
                        {z.kategorie ? (
                          <Badge
                            variant="outline"
                            className="mt-1 text-[10px]"
                          >
                            {z.kategorie}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="max-w-[140px] truncate">
                          {z.konto}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div>{formatEuro(z.betrag)}</div>
                        {z.anteil < 1 ? (
                          <div className="text-xs text-muted-foreground">
                            Anteil {formatProzent(z.anteil)} von{" "}
                            {formatEuro(z.betrag_brutto)}
                          </div>
                        ) : null}
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
