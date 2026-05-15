"use client";

// PROJ-8: Drill-down je Kennzahl — zeigt die in die Kennzahl
// eingeflossenen Buchungen (Nachvollziehbarkeit, keine Blackbox).
// Die Detaildaten stammen aus der bereits geladenen API-Antwort
// (buchung_details) — kein zusätzlicher Roundtrip.

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatEuro,
  type BuchungDetailDTO,
  type KennzahlZeileDTO,
} from "./typen";

function formatDatum(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || "—";
}

export function KennzahlDrilldown({
  zeile,
  details,
  open,
  onOpenChange,
}: {
  zeile: KennzahlZeileDTO | null;
  details: Record<string, BuchungDetailDTO>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ids = zeile?.buchung_ids ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {zeile && (
          <>
            <SheetHeader>
              <SheetTitle>
                Kz {zeile.kennzahl} · {zeile.bezeichnung}
              </SheetTitle>
              <SheetDescription>
                Bemessung {formatEuro(zeile.betrag)}
                {zeile.steuer !== null
                  ? ` · Steuer ${formatEuro(zeile.steuer)}`
                  : ""}{" "}
                · {ids.length} Buchung(en)
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 px-4 pb-6 text-sm">
              {ids.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
                  Für diese Kennzahl sind keine Buchungen einbezogen.
                </p>
              ) : (
                <ScrollArea className="h-[65vh] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Betrag</TableHead>
                        <TableHead>Verwendungszweck</TableHead>
                        <TableHead>Empfänger</TableHead>
                        <TableHead>Beleg</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ids.map((id) => {
                        const d = details[id];
                        if (!d) {
                          return (
                            <TableRow key={id}>
                              <TableCell
                                colSpan={5}
                                className="font-mono text-xs text-muted-foreground"
                              >
                                {id}
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return (
                          <TableRow key={id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDatum(d.buchung_datum)}
                            </TableCell>
                            <TableCell
                              className={`text-right tabular-nums ${
                                d.betrag < 0 ? "text-destructive" : ""
                              }`}
                            >
                              {formatEuro(d.betrag)}
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate">
                              {d.verwendungszweck ?? "—"}
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate text-muted-foreground">
                              {d.empfaenger ?? "—"}
                            </TableCell>
                            <TableCell>
                              {d.belegt ? (
                                <Badge variant="default">Beleg</Badge>
                              ) : (
                                <Badge variant="outline">kein Beleg</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Vollständige Buchungsdetails inkl. Beleg-Abgleich findest du
                unter „Buchungen“.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
