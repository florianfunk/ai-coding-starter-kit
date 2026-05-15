"use client";

// PROJ-9: EÜR-Aufstellung in Anlage-EÜR-Struktur.
// Betriebseinnahmen und Betriebsausgaben je Kategorie/EÜR-Zeile,
// Gesamtsummen und Gewinn/Verlust. Jede Position ist anklickbar
// (Drill-down auf die zugrunde liegenden Buchungen).

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export interface KategorieGruppe {
  kategorie_id: string;
  bezeichnung: string;
  typ: "einnahme" | "ausgabe";
  euer_zeile: string | null;
  summe: number;
  anzahl: number;
  buchungen: BuchungsZeile[];
}

function euro(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function Abschnitt({
  titel,
  gruppen,
  summe,
  summenLabel,
  onDrilldown,
}: {
  titel: string;
  gruppen: KategorieGruppe[];
  summe: number;
  summenLabel: string;
  onDrilldown: (g: KategorieGruppe) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {titel}
      </h3>
      {gruppen.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Keine Positionen in diesem Wirtschaftsjahr.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">EÜR-Zeile</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Anzahl</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gruppen.map((g) => (
                <TableRow
                  key={g.kategorie_id}
                  className="cursor-pointer"
                  onClick={() => onDrilldown(g)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Drill-down ${g.bezeichnung}`}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      onDrilldown(g);
                    }
                  }}
                >
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {g.euer_zeile ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {g.bezeichnung}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {g.anzahl}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {euro(g.summe)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell colSpan={3}>{summenLabel}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {euro(summe)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function EuerTabelle({
  einnahmen,
  ausgaben,
  summeEinnahmen,
  summeAusgaben,
  gewinn,
  onDrilldown,
}: {
  einnahmen: KategorieGruppe[];
  ausgaben: KategorieGruppe[];
  summeEinnahmen: number;
  summeAusgaben: number;
  gewinn: number;
  onDrilldown: (g: KategorieGruppe) => void;
}) {
  const istLeer = einnahmen.length === 0 && ausgaben.length === 0;
  const istGewinn = gewinn >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Einnahmen-Überschuss-Rechnung</CardTitle>
        <CardDescription>
          Aufstellung nach amtlicher Anlage EÜR. Klicke eine Position für die
          zugrunde liegenden Buchungen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {istLeer ? (
          <div className="rounded-md border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Für dieses Wirtschaftsjahr gibt es keine geschäftlichen
              Buchungen.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Importiere und klassifiziere Kontobewegungen, damit hier eine
              EÜR entsteht.
            </p>
          </div>
        ) : (
          <>
            <Abschnitt
              titel="Betriebseinnahmen"
              gruppen={einnahmen}
              summe={summeEinnahmen}
              summenLabel="Summe Betriebseinnahmen"
              onDrilldown={onDrilldown}
            />
            <Abschnitt
              titel="Betriebsausgaben"
              gruppen={ausgaben}
              summe={summeAusgaben}
              summenLabel="Summe Betriebsausgaben"
              onDrilldown={onDrilldown}
            />

            <div className="rounded-md border bg-muted/30 p-4">
              <div className="flex items-center justify-between text-base font-semibold">
                <span>{istGewinn ? "Gewinn" : "Verlust"} (§4 Abs.3 EStG)</span>
                <span
                  className={`tabular-nums ${
                    istGewinn ? "" : "text-destructive"
                  }`}
                >
                  {euro(gewinn)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Betriebseinnahmen {euro(summeEinnahmen)} − Betriebsausgaben{" "}
                {euro(summeAusgaben)}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
