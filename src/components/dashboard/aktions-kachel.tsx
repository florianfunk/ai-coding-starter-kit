// PROJ-12: Generische Aktions-Kachel — zeigt eine Kennzahl und verlinkt
// direkt auf die zugehörige Detailansicht. Server-renderbar (kein State).

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatZahl } from "./format";

export function AktionsKachel({
  titel,
  beschreibung,
  anzahl,
  href,
  cta,
  tonAlarm = false,
}: {
  titel: string;
  beschreibung: string;
  anzahl: number;
  href: string;
  cta: string;
  /** true → die Kennzahl als dringend kennzeichnen (>0 Fälle). */
  tonAlarm?: boolean;
}) {
  const aktiv = anzahl > 0;
  const alarm = tonAlarm && aktiv;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-medium">{titel}</CardTitle>
          {alarm ? (
            <Badge variant="destructive">Handlung nötig</Badge>
          ) : aktiv ? (
            <Badge variant="secondary">offen</Badge>
          ) : (
            <Badge variant="outline">erledigt</Badge>
          )}
        </div>
        <CardDescription>{beschreibung}</CardDescription>
      </CardHeader>
      <CardContent>
        <p
          className={`text-3xl font-semibold tabular-nums ${
            alarm ? "text-destructive" : ""
          }`}
        >
          {formatZahl(anzahl)}
        </p>
      </CardContent>
      <CardFooter>
        <Button
          asChild
          variant={alarm ? "default" : "outline"}
          size="sm"
          className="w-full"
        >
          <Link href={href}>{cta}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
