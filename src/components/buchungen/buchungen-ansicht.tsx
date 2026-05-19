"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Buchung,
  BuchungStatus,
  Kategorie,
  Klassifikation,
  Konto,
} from "@/lib/types";
import { BuchungDetailSheet } from "@/components/buchungen/buchung-detail-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_LABEL: Record<BuchungStatus, string> = {
  offen: "Offen",
  auto_verbucht: "Auto",
  zur_pruefung: "Prüfung",
  manuell_bestaetigt: "Bestätigt",
};

const STATUS_VARIANT: Record<
  BuchungStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  offen: "outline",
  auto_verbucht: "default",
  zur_pruefung: "destructive",
  manuell_bestaetigt: "secondary",
};

const KLASS_LABEL: Record<Klassifikation, string> = {
  privat: "Privat",
  geschaeftlich: "Geschäftlich",
  unklar: "Unklar",
  neutral: "Neutral",
};

function formatBetrag(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDatum(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function BuchungenAnsicht({
  buchungen,
  konten,
  kategorien,
  filter,
}: {
  buchungen: Buchung[];
  konten: Konto[];
  kategorien: Kategorie[];
  filter: { konto?: string; von?: string; bis?: string };
}) {
  const router = useRouter();
  const [konto, setKonto] = useState(filter.konto ?? "alle");
  const [von, setVon] = useState(filter.von ?? "");
  const [bis, setBis] = useState(filter.bis ?? "");
  const [detail, setDetail] = useState<Buchung | null>(null);
  const [detailOffen, setDetailOffen] = useState(false);

  function oeffneDetail(b: Buchung) {
    setDetail(b);
    setDetailOffen(true);
  }

  const kontoName = (id: string) =>
    konten.find((k) => k.id === id)?.bezeichnung ?? "—";

  function anwenden() {
    const params = new URLSearchParams();
    if (konto && konto !== "alle") params.set("konto", konto);
    if (von) params.set("von", von);
    if (bis) params.set("bis", bis);
    const qs = params.toString();
    router.push(qs ? `/buchungen?${qs}` : "/buchungen");
  }

  function zuruecksetzen() {
    setKonto("alle");
    setVon("");
    setBis("");
    router.push("/buchungen");
  }

  const istLeer = buchungen.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buchungsliste</CardTitle>
        <CardDescription>
          {istLeer
            ? "Keine Buchungen für die aktuelle Auswahl."
            : `${buchungen.length} Buchung(en) (max. 500 angezeigt).`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="f-konto">Konto</Label>
            <Select value={konto} onValueChange={setKonto}>
              <SelectTrigger id="f-konto">
                <SelectValue placeholder="Alle Konten" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Konten</SelectItem>
                {konten.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.bezeichnung}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-von">Von</Label>
            <Input
              id="f-von"
              type="date"
              value={von}
              onChange={(e) => setVon(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-bis">Bis</Label>
            <Input
              id="f-bis"
              type="date"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={anwenden}>Filtern</Button>
            <Button variant="outline" onClick={zuruecksetzen}>
              Zurücksetzen
            </Button>
          </div>
        </div>

        {istLeer ? (
          <div className="rounded-md border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Keine Buchungen vorhanden.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Importiere einen Kontoauszug unter „Bankkonten →
              Kontoauszug importieren“.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Konto</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Verwendungszweck</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Klassifikation</TableHead>
                  <TableHead className="text-right">Konfidenz</TableHead>
                  <TableHead className="w-[110px] whitespace-nowrap">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buchungen.map((b) => (
                  <TableRow
                    key={b.id}
                    onClick={() => oeffneDetail(b)}
                    className="cursor-pointer"
                  >
                    <TableCell className="text-sm">
                      {kontoName(b.konto_id)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDatum(b.buchung_datum)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        b.betrag < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {formatBetrag(b.betrag)}{" "}
                      {b.waehrung !== "EUR" ? (
                        <span className="text-xs text-muted-foreground">
                          {b.waehrung}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-sm">
                      {b.verwendungszweck ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {b.empfaenger ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.klassifikation
                        ? KLASS_LABEL[b.klassifikation]
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {b.konfidenz === null
                        ? "—"
                        : `${Math.round(b.konfidenz * 100)} %`}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        variant={STATUS_VARIANT[b.status]}
                        className="whitespace-nowrap"
                      >
                        {STATUS_LABEL[b.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <BuchungDetailSheet
        buchung={detail}
        kategorien={kategorien}
        open={detailOffen}
        onOpenChange={setDetailOffen}
      />
    </Card>
  );
}
