// PROJ-12: Sync-Status-Kachel (Paperless-Sync / Kontoimport).
// Zeigt den Zeitpunkt des letzten Laufs und warnt bei Fehlerstatus.
// Server-renderbar.

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { SyncStatus } from "@/lib/dashboard/aggregate";
import { formatZeitpunkt } from "./format";

const STATUS_LABEL: Record<"laeuft" | "fertig" | "fehler", string> = {
  laeuft: "Läuft",
  fertig: "Erfolgreich",
  fehler: "Fehler",
};

export function SyncKachel({
  titel,
  beschreibung,
  status,
  href,
  cta,
}: {
  titel: string;
  beschreibung: string;
  status: SyncStatus;
  href: string;
  cta: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-medium">{titel}</CardTitle>
          {!status.vorhanden ? (
            <Badge variant="outline">noch nie</Badge>
          ) : status.ist_fehler ? (
            <Badge variant="destructive">Fehler</Badge>
          ) : status.status === "laeuft" ? (
            <Badge variant="secondary">läuft</Badge>
          ) : (
            <Badge variant="secondary">ok</Badge>
          )}
        </div>
        <CardDescription>{beschreibung}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.vorhanden ? (
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Letzter Lauf</p>
            <p className="font-medium tabular-nums">
              {formatZeitpunkt(status.zeitpunkt)}
            </p>
            <p className="text-xs text-muted-foreground">
              Status: {status.status ? STATUS_LABEL[status.status] : "—"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Es wurde noch kein Lauf durchgeführt.
          </p>
        )}

        {status.ist_fehler ? (
          <Alert variant="destructive">
            <AlertTitle>Letzter Lauf fehlgeschlagen</AlertTitle>
            <AlertDescription>
              {status.fehler_text
                ? status.fehler_text
                : "Der letzte Lauf endete mit einem Fehler. Bitte erneut ausführen."}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={href}>{cta}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
