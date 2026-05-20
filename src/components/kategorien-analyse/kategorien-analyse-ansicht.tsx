"use client";

// PROJ-14 — Hauptansicht: Filter + Aggregat-Tabelle. Drill-Down-Sheet
// liegt in der Schwester-Komponente und wird je Kategorie eingeblendet.

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type {
  AnalyseResponse,
  KategorieAggregat,
} from "@/app/api/kategorien-analyse/route";
import { KategorieDrilldown } from "@/components/kategorien-analyse/kategorie-drilldown";

interface Konto {
  id: string;
  bezeichnung: string;
  typ: "bank" | "paypal" | "kreditkarte";
}

const TYP_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  einnahme: "default",
  ausgabe: "secondary",
  privat: "outline",
  neutral: "outline",
  ohne: "destructive",
};

const TYP_LABEL: Record<string, string> = {
  einnahme: "Einnahme",
  ausgabe: "Ausgabe",
  privat: "Privat",
  neutral: "Neutral",
  ohne: "Ohne",
};

function eur(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export function KategorienAnalyseAnsicht({
  konten,
  jahre,
}: {
  konten: Konto[];
  jahre: number[];
}) {
  const [jahr, setJahr] = useState<string>("alle");
  const [kontoId, setKontoId] = useState<string>("alle");
  const [nurSteuerrelevant, setNurSteuerrelevant] = useState(false);
  const [daten, setDaten] = useState<AnalyseResponse | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [drillKategorie, setDrillKategorie] = useState<KategorieAggregat | null>(null);

  function ladeDaten() {
    setLadeFehler(null);
    const params = new URLSearchParams();
    if (jahr !== "alle") params.set("jahr", jahr);
    if (kontoId !== "alle") params.set("konto_id", kontoId);
    if (nurSteuerrelevant) params.set("nur_steuerrelevant", "true");
    startTransition(async () => {
      try {
        const r = await fetch(`/api/kategorien-analyse?${params.toString()}`);
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        const j = (await r.json()) as AnalyseResponse;
        setDaten(j);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        setLadeFehler(msg);
        toast.error("Daten konnten nicht geladen werden: " + msg);
      }
    });
  }

  useEffect(() => {
    ladeDaten();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jahr, kontoId, nurSteuerrelevant]);

  const sichtbar = (daten?.kategorien ?? []).filter((k) => k.anzahl > 0);

  return (
    <div className="space-y-6">
      {/* Filter */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="jahr">Wirtschaftsjahr</Label>
            <Select value={jahr} onValueChange={setJahr}>
              <SelectTrigger id="jahr" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Jahre</SelectItem>
                {jahre.map((j) => (
                  <SelectItem key={j} value={String(j)}>
                    {j}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="konto">Konto</Label>
            <Select value={kontoId} onValueChange={setKontoId}>
              <SelectTrigger id="konto" className="w-[220px]">
                <SelectValue />
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
          <div className="flex items-center gap-2">
            <Switch
              id="steuerrelevant"
              checked={nurSteuerrelevant}
              onCheckedChange={setNurSteuerrelevant}
            />
            <Label htmlFor="steuerrelevant" className="cursor-pointer">
              Nur steuerrelevant
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => ladeDaten()}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : null}
            Aktualisieren
          </Button>
        </CardContent>
      </Card>

      {/* Gesamtkennzahlen */}
      {daten && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kennzahl label="Buchungen gesamt" wert={String(daten.gesamt.buchungen)} />
          <Kennzahl
            label="Summe (netto/brutto-Mix)"
            wert={eur(daten.gesamt.summe)}
          />
          <Kennzahl
            label="Auto-verbucht"
            wert={`${daten.gesamt.auto_verbucht} (${pct(daten.gesamt.auto_verbucht, daten.gesamt.buchungen)})`}
          />
          <Kennzahl
            label="Zur Prüfung"
            wert={`${daten.gesamt.zur_pruefung} (${pct(daten.gesamt.zur_pruefung, daten.gesamt.buchungen)})`}
          />
        </div>
      )}

      {/* Tabelle */}
      <Card>
        <CardContent className="pt-6">
          {ladeFehler ? (
            <p className="text-sm text-destructive">{ladeFehler}</p>
          ) : !daten ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : sichtbar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Buchungen für die aktuellen Filter.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="text-right">USt</TableHead>
                  <TableHead className="text-right">Anzahl</TableHead>
                  <TableHead className="text-right">Summe</TableHead>
                  <TableHead className="text-right">⌀ Konf.</TableHead>
                  <TableHead>Status-Mix</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sichtbar.map((k) => (
                  <TableRow
                    key={k.kategorie_id ?? "ohne"}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setDrillKategorie(k)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {k.bezeichnung}
                        {!k.aktiv && k.kategorie_id ? (
                          <Badge variant="outline" className="text-xs">
                            inaktiv
                          </Badge>
                        ) : null}
                        {k.unsicher > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            ⚠ {k.unsicher} unsicher
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={TYP_BADGE[k.typ] ?? "outline"}>
                        {TYP_LABEL[k.typ] ?? k.typ}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {k.ust_satz === null ? "—" : `${k.ust_satz} %`}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {k.anzahl}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono">
                      {eur(k.summe)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {k.konfidenz_avg === null
                        ? "—"
                        : `${Math.round(k.konfidenz_avg * 100)} %`}
                    </TableCell>
                    <TableCell>
                      <StatusMix mix={k.status_mix} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrillKategorie(k);
                        }}
                      >
                        Öffnen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Drill-Down */}
      <KategorieDrilldown
        kategorie={drillKategorie}
        jahr={jahr === "alle" ? null : jahr}
        kontoId={kontoId === "alle" ? null : kontoId}
        nurSteuerrelevant={nurSteuerrelevant}
        onClose={() => setDrillKategorie(null)}
        onMutiert={ladeDaten}
      />
    </div>
  );
}

function Kennzahl({ label, wert }: { label: string; wert: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{wert}</div>
      </CardContent>
    </Card>
  );
}

function pct(teil: number, ganzes: number): string {
  if (!ganzes) return "0 %";
  return `${Math.round((teil / ganzes) * 100)} %`;
}

function StatusMix({
  mix,
}: {
  mix: KategorieAggregat["status_mix"];
}) {
  const items = [
    { label: "auto", n: mix.auto_verbucht, variant: "default" as const },
    { label: "prüf", n: mix.zur_pruefung, variant: "destructive" as const },
    { label: "best", n: mix.manuell_bestaetigt, variant: "secondary" as const },
    { label: "offen", n: mix.offen, variant: "outline" as const },
  ].filter((x) => x.n > 0);
  if (items.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((x) => (
        <Badge key={x.label} variant={x.variant} className="text-xs">
          {x.label}: {x.n}
        </Badge>
      ))}
    </div>
  );
}
