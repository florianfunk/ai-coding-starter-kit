"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import type { Konto } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Protokoll {
  importiert: number;
  uebersprungen: number;
  fehlerhaft: number;
}

interface VorschauZeile {
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
  waehrung: string;
  duplikat_hash: string;
  duplikat: boolean;
}

interface FehlerZeile {
  zeile: number;
  grund: string;
}

const TYP_LABEL: Record<string, string> = {
  bank: "Bank",
  paypal: "PayPal",
  kreditkarte: "Kreditkarte",
};

function formatBetrag(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function ImportPanel({ konten }: { konten: Konto[] }) {
  const router = useRouter();
  const [kontoId, setKontoId] = useState<string>(konten[0]?.id ?? "");
  const [datei, setDatei] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [vorschau, setVorschau] = useState<VorschauZeile[] | null>(null);
  const [protokoll, setProtokoll] = useState<Protokoll | null>(null);
  const [fehler, setFehler] = useState<FehlerZeile[]>([]);
  const [committed, setCommitted] = useState(false);

  const aktuellesKonto = useMemo(
    () => konten.find((k) => k.id === kontoId) ?? null,
    [konten, kontoId],
  );
  const mappingFehlt = aktuellesKonto != null && !aktuellesKonto.mapping;

  function reset() {
    setVorschau(null);
    setProtokoll(null);
    setFehler([]);
    setCommitted(false);
  }

  async function senden(preview: boolean) {
    if (!datei) {
      toast.error("Bitte zuerst eine Datei wählen");
      return;
    }
    if (!kontoId) {
      toast.error("Bitte ein Konto wählen");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", datei);
      fd.append("konto_id", kontoId);
      fd.append("preview", preview ? "1" : "0");

      const res = await fetch("/api/konten/import", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();

      if (!res.ok) {
        setProtokoll(json.protokoll ?? null);
        setFehler(json.fehler ?? []);
        setVorschau(null);
        toast.error(json.error ?? "Import fehlgeschlagen");
        return;
      }

      setProtokoll(json.protokoll ?? null);
      setFehler(json.fehler ?? []);

      if (preview) {
        setVorschau(json.zeilen ?? []);
        setCommitted(false);
      } else {
        setVorschau(null);
        setCommitted(true);
        toast.success(
          `Import abgeschlossen: ${json.protokoll?.importiert ?? 0} übernommen`,
        );
        router.refresh();
      }
    } catch {
      toast.error("Netzwerkfehler beim Import");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datei & Konto</CardTitle>
          <CardDescription>
            Wähle das Zielkonto und die Export-Datei. Das gespeicherte
            Spalten-Mapping des Kontos wird automatisch angewendet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="konto">Konto</Label>
              <Select
                value={kontoId}
                onValueChange={(v) => {
                  setKontoId(v);
                  reset();
                }}
              >
                <SelectTrigger id="konto">
                  <SelectValue placeholder="Konto wählen" />
                </SelectTrigger>
                <SelectContent>
                  {konten.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.bezeichnung} ({TYP_LABEL[k.typ] ?? k.typ})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="datei">Datei (.xlsx / .csv)</Label>
              <Input
                id="datei"
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  setDatei(e.target.files?.[0] ?? null);
                  reset();
                }}
              />
            </div>
          </div>

          {mappingFehlt && (
            <Alert variant="destructive">
              <AlertTitle>Kein Spalten-Mapping</AlertTitle>
              <AlertDescription>
                Für dieses Konto ist noch kein Mapping hinterlegt. Bitte zuerst
                in den{" "}
                <Link
                  href="/einstellungen/konten"
                  className="font-medium underline underline-offset-2"
                >
                  Konto-Einstellungen
                </Link>{" "}
                konfigurieren.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => senden(true)}
              disabled={busy || !datei || mappingFehlt}
              variant="outline"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Vorschau erzeugen
            </Button>
            <Button
              onClick={() => senden(false)}
              disabled={busy || !datei || vorschau === null || committed}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Übernehmen
            </Button>
          </div>
        </CardContent>
      </Card>

      {protokoll && (
        <Card>
          <CardHeader>
            <CardTitle>Import-Protokoll</CardTitle>
            <CardDescription>
              {committed
                ? "Buchungen wurden übernommen."
                : "Vorschau — noch nichts gespeichert."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-2xl font-semibold">
                  {protokoll.importiert}
                </div>
                <div className="text-muted-foreground">
                  {committed ? "importiert" : "neu (werden importiert)"}
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {protokoll.uebersprungen}
                </div>
                <div className="text-muted-foreground">
                  übersprungen (Duplikate)
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold">
                  {protokoll.fehlerhaft}
                </div>
                <div className="text-muted-foreground">fehlerhaft</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {fehler.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Nicht verarbeitbare Zeilen ({fehler.length})</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              {fehler.slice(0, 20).map((f, i) => (
                <li key={i}>
                  Zeile {f.zeile}: {f.grund}
                </li>
              ))}
              {fehler.length > 20 && (
                <li>… und {fehler.length - 20} weitere</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {vorschau && (
        <Card>
          <CardHeader>
            <CardTitle>Vorschau ({vorschau.length} Zeilen)</CardTitle>
            <CardDescription>
              Als Duplikat markierte Zeilen werden NICHT erneut importiert.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vorschau.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Buchungen in der Datei erkannt.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                      <TableHead>Währung</TableHead>
                      <TableHead>Verwendungszweck</TableHead>
                      <TableHead>Empfänger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vorschau.map((z, i) => (
                      <TableRow
                        key={`${z.duplikat_hash}-${i}`}
                        className={z.duplikat ? "opacity-60" : ""}
                      >
                        <TableCell>
                          {z.duplikat ? (
                            <span className="inline-flex rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              Duplikat
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-tint-cyan px-2 py-0.5 text-[10px] font-semibold text-income-strong">
                              Neu
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{z.buchung_datum}</TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
                            z.betrag < 0 ? "text-destructive" : ""
                          }`}
                        >
                          {formatBetrag(z.betrag)}
                        </TableCell>
                        <TableCell>{z.waehrung}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-sm">
                          {z.verwendungszweck ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {z.empfaenger ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {committed && (
        <Alert>
          <AlertTitle>Fertig</AlertTitle>
          <AlertDescription>
            Die Buchungen sind importiert.{" "}
            <Link
              href="/buchungen"
              className="font-medium underline underline-offset-2"
            >
              Zur Buchungsliste
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
