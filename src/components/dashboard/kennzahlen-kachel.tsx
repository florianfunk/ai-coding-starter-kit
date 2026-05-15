// PROJ-12: Kennzahlen laufendes Wirtschaftsjahr.
// WICHTIG: Diese Werte sind eine einfache, VORLÄUFIGE Summierung und KEINE
// belastbare EÜR/USt-Berechnung — sie werden hier klar als "vorläufig"
// gekennzeichnet (Architektur §1 Determinismus). Server-renderbar.

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { JahresKennzahlen } from "@/lib/dashboard/aggregate";
import { formatDatum, formatEuro } from "./format";

function Zeile({
  label,
  wert,
  betont = false,
  negativ = false,
}: {
  label: string;
  wert: string;
  betont?: boolean;
  negativ?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span
        className={`text-sm ${
          betont ? "font-medium" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${betont ? "text-lg font-semibold" : "text-sm"} ${
          negativ ? "text-destructive" : ""
        }`}
      >
        {wert}
      </span>
    </div>
  );
}

export function KennzahlenKachel({ jahr }: { jahr: JahresKennzahlen }) {
  const verlust = jahr.vorlaeufiger_gewinn < 0;
  const erstattung = jahr.voraussichtliche_ust_zahllast < 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-medium">
              Kennzahlen laufendes Jahr
            </CardTitle>
            <CardDescription>
              Wirtschaftsjahr {jahr.jahr} ({formatDatum(jahr.zeitraum.von)} –{" "}
              {formatDatum(jahr.zeitraum.bis)})
            </CardDescription>
          </div>
          <Badge variant="secondary">vorläufig</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Zeile
            label="Betriebseinnahmen"
            wert={formatEuro(jahr.einnahmen)}
          />
          <Zeile
            label="Betriebsausgaben"
            wert={formatEuro(jahr.ausgaben)}
          />
          <Separator className="my-2" />
          <Zeile
            label={verlust ? "Vorläufiger Verlust" : "Vorläufiger Gewinn"}
            wert={formatEuro(jahr.vorlaeufiger_gewinn)}
            betont
            negativ={verlust}
          />
          <Zeile
            label={
              erstattung
                ? "Voraussichtl. USt-Erstattung"
                : "Voraussichtl. USt-Zahllast"
            }
            wert={formatEuro(jahr.voraussichtliche_ust_zahllast)}
          />
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            Vorläufige Schätzung aus {jahr.anzahl_buchungen} geschäftlichen
            Buchungen des laufenden Wirtschaftsjahres. Verbindliche Werte
            liefern EÜR und USt-Voranmeldung.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/euer">Zur EÜR</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/ust-voranmeldung">Zur USt-VA</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
