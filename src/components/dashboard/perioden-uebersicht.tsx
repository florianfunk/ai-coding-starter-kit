// PROJ-12: Periodenstatus-Übersicht (USt-VA-Perioden & Wirtschaftsjahre).
// Zeigt je Periode den Status offen/geprüft/abgeschlossen und verlinkt zur
// jeweiligen Auswertung. Server-renderbar.

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PeriodenZeile } from "@/lib/dashboard/aggregate";

const STATUS_LABEL: Record<
  "offen" | "geprueft" | "abgeschlossen",
  string
> = {
  offen: "Offen",
  geprueft: "Geprüft",
  abgeschlossen: "Abgeschlossen",
};

const STATUS_VARIANT: Record<
  "offen" | "geprueft" | "abgeschlossen",
  "default" | "secondary" | "outline"
> = {
  offen: "outline",
  geprueft: "secondary",
  abgeschlossen: "default",
};

function ziel(z: PeriodenZeile): string {
  return z.art === "wirtschaftsjahr"
    ? `/euer?jahr=${z.jahr}`
    : `/ust-voranmeldung?jahr=${z.jahr}`;
}

export function PeriodenUebersicht({
  perioden,
}: {
  perioden: PeriodenZeile[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Periodenstatus
        </CardTitle>
        <CardDescription>
          Bearbeitungsstand je USt-VA-Periode und Wirtschaftsjahr. Klicke eine
          Zeile, um zur Auswertung zu springen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {perioden.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Noch keine Steuerperioden angelegt.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Perioden entstehen bei der ersten USt-Voranmeldung bzw.
              Jahres-EÜR.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perioden.map((z) => (
                  <TableRow key={`${z.art}-${z.jahr}-${z.periode ?? "j"}`}>
                    <TableCell className="font-medium">{z.label}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[z.status]}>
                        {STATUS_LABEL[z.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={ziel(z)}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Öffnen
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
