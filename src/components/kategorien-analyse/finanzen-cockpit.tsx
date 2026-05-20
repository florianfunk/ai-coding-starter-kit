"use client";

// PROJ-14 — Finanz-Cockpit: visuelle Sicht auf alles, was im gewählten
// Zeitraum auf den Konten passiert ist. Diagramme + Tabellen, je nach
// Tab (Geschäftlich/Privat/Alle) gefiltert.

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Bereich } from "@/lib/validation/kategorien-analyse";
import type {
  CockpitResponse,
  KategorieAnteil,
  MonatsPunkt,
} from "@/app/api/finanzen/cockpit/route";

function eur(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function eurKompakt(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function monatLabel(m: string): string {
  // YYYY-MM → "Mai 26"
  const [y, mo] = m.split("-");
  const names = [
    "Jan",
    "Feb",
    "Mär",
    "Apr",
    "Mai",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Okt",
    "Nov",
    "Dez",
  ];
  return `${names[Number(mo) - 1] ?? mo} ${y.slice(2)}`;
}

export interface CockpitFilter {
  von: string | null;
  bis: string | null;
  kontoId: string | null;
  bereich: Bereich;
}

export function FinanzenCockpit({ filter }: { filter: CockpitFilter }) {
  const [daten, setDaten] = useState<CockpitResponse | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ladeDaten = useCallback(() => {
    setFehler(null);
    const params = new URLSearchParams();
    if (filter.von) params.set("von", filter.von);
    if (filter.bis) params.set("bis", filter.bis);
    if (filter.kontoId) params.set("konto_id", filter.kontoId);
    if (filter.bereich !== "alle") params.set("bereich", filter.bereich);
    const qs = params.toString();
    startTransition(async () => {
      try {
        const r = await fetch(`/api/finanzen/cockpit?${qs}`);
        if (!r.ok) throw new Error(`Cockpit HTTP ${r.status}`);
        setDaten((await r.json()) as CockpitResponse);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        setFehler(msg);
        toast.error("Cockpit konnte nicht geladen werden: " + msg);
      }
    });
  }, [filter.von, filter.bis, filter.kontoId, filter.bereich]);

  useEffect(() => {
    ladeDaten();
  }, [ladeDaten]);

  if (fehler) {
    return <p className="text-sm text-destructive">{fehler}</p>;
  }
  if (!daten) {
    return (
      <p className="text-sm text-muted-foreground">
        {isPending ? "Lade Cockpit…" : "Keine Daten."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Kennzahlen daten={daten} />
      <MonatsVerlauf monate={daten.monate} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <TopKategorienDonut kategorien={daten.top_kategorien} />
        </div>
        <div className="lg:col-span-3">
          <TopEmpfaenger empfaenger={daten.top_empfaenger} />
        </div>
      </div>
    </div>
  );
}

function Kennzahlen({ daten }: { daten: CockpitResponse }) {
  const items: Array<{
    label: string;
    wert: string;
    akzent: "positiv" | "negativ" | "neutral";
    hint?: string;
  }> = [
    {
      label: "Geldeingänge",
      wert: eur(daten.kennzahlen.einnahmen),
      akzent: "positiv",
    },
    {
      label: "Geldausgänge",
      wert: eur(daten.kennzahlen.ausgaben),
      akzent: "negativ",
    },
    {
      label: "Saldo",
      wert: eur(daten.kennzahlen.saldo),
      akzent: daten.kennzahlen.saldo >= 0 ? "positiv" : "negativ",
    },
    {
      label: "Buchungen",
      wert: String(daten.kennzahlen.buchungen),
      akzent: "neutral",
      hint: "im Zeitraum",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((i) => (
        <Card key={i.label}>
          <CardContent className="pt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {i.label}
            </div>
            <div
              className={
                "mt-1 text-xl font-semibold tabular-nums " +
                (i.akzent === "positiv"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : i.akzent === "negativ"
                    ? "text-destructive"
                    : "")
              }
            >
              {i.wert}
            </div>
            {i.hint ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{i.hint}</div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const MONATS_CHART_CFG = {
  einnahmen: { label: "Einnahmen", color: "hsl(142 71% 45%)" },
  ausgaben: { label: "Ausgaben", color: "hsl(0 72% 51%)" },
  saldo: { label: "Saldo", color: "hsl(220 90% 56%)" },
} satisfies ChartConfig;

function MonatsVerlauf({ monate }: { monate: MonatsPunkt[] }) {
  const daten = useMemo(
    () =>
      monate.map((m) => ({
        ...m,
        label: monatLabel(m.monat),
      })),
    [monate],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monatsverlauf</CardTitle>
      </CardHeader>
      <CardContent>
        {daten.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Daten im gewählten Zeitraum.
          </p>
        ) : (
          <ChartContainer
            config={MONATS_CHART_CFG}
            className="h-[280px] w-full"
          >
            <ComposedChart data={daten}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => eurKompakt(Number(v))}
                width={70}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => [
                      eur(Number(value)),
                      MONATS_CHART_CFG[name as keyof typeof MONATS_CHART_CFG]
                        ?.label ?? String(name),
                    ]}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="einnahmen" fill="var(--color-einnahmen)" radius={4} />
              <Bar dataKey="ausgaben" fill="var(--color-ausgaben)" radius={4} />
              <Line
                type="monotone"
                dataKey="saldo"
                stroke="var(--color-saldo)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

const DONUT_FARBEN = [
  "hsl(220 90% 56%)",
  "hsl(280 70% 55%)",
  "hsl(340 75% 55%)",
  "hsl(20 90% 55%)",
  "hsl(45 90% 50%)",
  "hsl(170 65% 45%)",
  "hsl(200 80% 50%)",
  "hsl(0 0% 60%)",
];

function TopKategorienDonut({ kategorien }: { kategorien: KategorieAnteil[] }) {
  const daten = kategorien.map((k, i) => ({
    name: k.bezeichnung,
    value: k.summe,
    fill: DONUT_FARBEN[i % DONUT_FARBEN.length],
  }));
  const summe = kategorien.reduce((s, k) => s + k.summe, 0);
  const config: ChartConfig = Object.fromEntries(
    daten.map((d) => [d.name, { label: d.name, color: d.fill }]),
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Top-Ausgaben nach Kategorie</CardTitle>
      </CardHeader>
      <CardContent>
        {kategorien.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Ausgaben im Zeitraum.
          </p>
        ) : (
          <div className="space-y-4">
            <ChartContainer config={config} className="mx-auto h-[220px] w-full">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name) => [eur(Number(value)), String(name)]}
                    />
                  }
                />
                <Pie
                  data={daten}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  strokeWidth={2}
                >
                  {daten.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="space-y-1.5 text-sm">
              {kategorien.map((k, i) => (
                <li
                  key={k.kategorie_id ?? `ohne-${i}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          DONUT_FARBEN[i % DONUT_FARBEN.length],
                      }}
                    />
                    <span className="truncate">{k.bezeichnung}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 tabular-nums">
                    <span className="text-muted-foreground">
                      {Math.round(k.anteil * 100)} %
                    </span>
                    <span className="font-mono">{eur(k.summe)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Summe Top-Kategorien: {eur(summe)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopEmpfaenger({
  empfaenger,
}: {
  empfaenger: CockpitResponse["top_empfaenger"];
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Top-Empfänger</CardTitle>
      </CardHeader>
      <CardContent>
        {empfaenger.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine Ausgaben im Zeitraum.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empfänger</TableHead>
                <TableHead className="text-right">Anzahl</TableHead>
                <TableHead className="text-right">⌀ pro Zahlung</TableHead>
                <TableHead className="text-right">Summe</TableHead>
                <TableHead className="w-[60px] text-right">Anteil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empfaenger.map((e) => (
                <TableRow key={e.empfaenger}>
                  <TableCell className="max-w-[260px] truncate font-medium">
                    {e.empfaenger}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.anzahl}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {eur(e.schnitt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-mono">
                    {eur(e.summe)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {Math.round(e.anteil * 100)} %
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

