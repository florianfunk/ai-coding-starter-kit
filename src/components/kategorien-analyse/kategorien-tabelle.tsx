"use client";

// PROJ-14 — Aggregat-Tabelle "Kategorien nach Bereich". Lädt sich selbst
// auf Filter-Änderung neu. Bereichs-Filter kommt von außen (Tab-Wahl):
// 'geschaeft' = EÜR-Sicht, 'privat' = Negativ-Liste, 'alle' = Komplett.

import { useEffect, useState, useTransition, Fragment } from "react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Bereich } from "@/lib/validation/kategorien-analyse";
import { KategorieDrilldown } from "@/components/kategorien-analyse/kategorie-drilldown";

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

const TYP_GRUPPEN_LABEL: Record<string, string> = {
  einnahme: "Einnahmen",
  ausgabe: "Ausgaben",
  privat: "Privat",
  neutral: "Neutral",
  ohne: "Ohne Kategorie",
};

function eur(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function pct(teil: number, ganzes: number): string {
  if (!ganzes) return "0 %";
  return `${Math.round((teil / ganzes) * 100)} %`;
}

export interface KategorienFilter {
  von: string | null;
  bis: string | null;
  kontoId: string | null;
  bereich: Bereich;
  nurSteuerrelevant: boolean;
}

export function KategorienTabelle({ filter }: { filter: KategorienFilter }) {
  const [daten, setDaten] = useState<AnalyseResponse | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [drillKategorie, setDrillKategorie] = useState<KategorieAggregat | null>(null);

  function ladeDaten() {
    setLadeFehler(null);
    const params = new URLSearchParams();
    if (filter.von) params.set("von", filter.von);
    if (filter.bis) params.set("bis", filter.bis);
    if (filter.kontoId) params.set("konto_id", filter.kontoId);
    if (filter.bereich !== "alle") params.set("bereich", filter.bereich);
    if (filter.nurSteuerrelevant) params.set("nur_steuerrelevant", "true");
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
  }, [
    filter.von,
    filter.bis,
    filter.kontoId,
    filter.bereich,
    filter.nurSteuerrelevant,
  ]);

  const sichtbar = (daten?.kategorien ?? []).filter((k) => k.anzahl > 0);

  return (
    <div className="space-y-6">
      {/* Geld-Eingänge / Ausgänge / Saldo */}
      {daten && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kennzahl
            label="Geldeingänge (Einnahmen)"
            wert={eur(daten.gesamt.summe_einnahmen)}
            akzent="positiv"
          />
          <Kennzahl
            label="Geldausgänge (Ausgaben)"
            wert={eur(daten.gesamt.summe_ausgaben)}
            akzent="negativ"
          />
          <Kennzahl
            label="Saldo (Einnahmen − Ausgaben)"
            wert={eur(daten.gesamt.saldo)}
            akzent={daten.gesamt.saldo >= 0 ? "positiv" : "negativ"}
          />
        </div>
      )}

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

      <Card>
        <CardContent className="pt-6">
          {ladeFehler ? (
            <p className="text-sm text-destructive">{ladeFehler}</p>
          ) : !daten ? (
            <p className="text-sm text-muted-foreground">
              {isPending ? "Lade…" : "Keine Daten."}
            </p>
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
                {renderGruppiert(sichtbar, setDrillKategorie)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <KategorieDrilldown
        kategorie={drillKategorie}
        von={filter.von}
        bis={filter.bis}
        kontoId={filter.kontoId}
        nurSteuerrelevant={filter.nurSteuerrelevant}
        onClose={() => setDrillKategorie(null)}
        onMutiert={ladeDaten}
      />
    </div>
  );
}

function renderGruppiert(
  sichtbar: KategorieAggregat[],
  onDrill: (k: KategorieAggregat) => void,
) {
  const gruppen = new Map<string, KategorieAggregat[]>();
  for (const k of sichtbar) {
    const arr = gruppen.get(k.typ) ?? [];
    arr.push(k);
    gruppen.set(k.typ, arr);
  }
  const rows: React.ReactNode[] = [];
  for (const [typ, kats] of gruppen) {
    for (const k of kats) {
      rows.push(
        <TableRow
          key={k.kategorie_id ?? `ohne-${typ}`}
          className="cursor-pointer hover:bg-muted/40"
          onClick={() => onDrill(k)}
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
          <TableCell className="text-right tabular-nums">{k.anzahl}</TableCell>
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
                onDrill(k);
              }}
            >
              Öffnen
            </Button>
          </TableCell>
        </TableRow>,
      );
    }
    const anzahl = kats.reduce((s, k) => s + k.anzahl, 0);
    const summeRaw = kats.reduce((s, k) => s + k.summe, 0);
    const summe = typ === "ausgabe" ? -Math.abs(summeRaw) : summeRaw;
    rows.push(
      <TableRow
        key={`subtotal-${typ}`}
        className="border-t-2 bg-muted/30 font-semibold hover:bg-muted/40"
      >
        <TableCell colSpan={3} className="text-xs uppercase tracking-wide">
          Σ {TYP_GRUPPEN_LABEL[typ] ?? typ}
        </TableCell>
        <TableCell className="text-right tabular-nums">{anzahl}</TableCell>
        <TableCell
          className={
            "text-right tabular-nums font-mono " +
            (typ === "einnahme"
              ? "text-emerald-600 dark:text-emerald-400"
              : typ === "ausgabe"
                ? "text-destructive"
                : "")
          }
        >
          {eur(Math.round(summe * 100) / 100)}
        </TableCell>
        <TableCell colSpan={3} />
      </TableRow>,
    );
  }
  return <Fragment>{rows}</Fragment>;
}

function Kennzahl({
  label,
  wert,
  akzent,
}: {
  label: string;
  wert: string;
  akzent?: "positiv" | "negativ";
}) {
  const klasse =
    akzent === "positiv"
      ? "text-emerald-600 dark:text-emerald-400"
      : akzent === "negativ"
        ? "text-destructive"
        : "";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={`mt-1 text-xl font-semibold tabular-nums ${klasse}`}>
          {wert}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusMix({ mix }: { mix: KategorieAggregat["status_mix"] }) {
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
