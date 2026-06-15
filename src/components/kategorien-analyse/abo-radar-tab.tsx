"use client";

// PROJ-14 — Eigener Tab "Abo-Radar". Wrapper um die AboRadar-Komponente:
// lädt die Wiederkehr-Daten selbständig (gleicher API-Endpoint wie früher
// im Cockpit) und zeigt sie groß flächendeckend an, statt als Sektion im
// Gesamt-Cockpit.

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { AboRadar } from "@/components/kategorien-analyse/abo-radar";
import type { Bereich } from "@/lib/validation/kategorien-analyse";
import type { WiederkehrendResponse } from "@/app/api/finanzen/wiederkehrend/route";

function eur(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export interface AboRadarTabFilter {
  von: string | null;
  bis: string | null;
  kontoId: string | null;
  bereich: Bereich;
}

export function AboRadarTab({
  filter,
  refreshKey,
}: {
  filter: AboRadarTabFilter;
  // PROJ-20-Fix: erzwingt Neuladen (Fokus/Manuell/Zeitraum-Reselect), damit
  // die Analyse nach einem Import nie veralteten Datenstand zeigt.
  refreshKey?: number;
}) {
  const [daten, setDaten] = useState<WiederkehrendResponse | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ladeDaten = useCallback(() => {
    setFehler(null);
    const params = new URLSearchParams();
    if (filter.von) params.set("von", filter.von);
    if (filter.bis) params.set("bis", filter.bis);
    if (filter.kontoId) params.set("konto_id", filter.kontoId);
    if (filter.bereich !== "alle") params.set("bereich", filter.bereich);
    startTransition(async () => {
      try {
        const r = await fetch(
          `/api/finanzen/wiederkehrend?${params.toString()}`,
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setDaten((await r.json()) as WiederkehrendResponse);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        setFehler(msg);
        toast.error("Abo-Radar konnte nicht geladen werden: " + msg);
      }
    });
  }, [filter.von, filter.bis, filter.kontoId, filter.bereich, refreshKey]);

  useEffect(() => {
    ladeDaten();
  }, [ladeDaten]);

  if (fehler) {
    return <p className="text-sm text-destructive">{fehler}</p>;
  }
  if (!daten) {
    return (
      <p className="text-sm text-muted-foreground">
        {isPending ? "Lade Abo-Radar…" : "Keine Daten."}
      </p>
    );
  }

  const aktiv = daten.items.filter((i) => i.noch_aktiv);
  const inaktiv = daten.items.filter((i) => !i.noch_aktiv);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KennCard
          label="Aktive Ausgaben / Jahr"
          wert={eur(daten.jahresbelastung_ausgaben_aktiv)}
          akzent="negativ"
          hint={`${aktiv.length} aktive · ${inaktiv.length} gekündigt`}
        />
        <KennCard
          label="Aktive Einnahmen / Jahr"
          wert={eur(daten.jahresbelastung_einnahmen_aktiv)}
          akzent="positiv"
          hint="Gehälter, Mieten, Erstattungen"
        />
        <KennCard
          label="Erkannte Wiederkehr-Items"
          wert={String(daten.items.length)}
          hint="≥ 3 Buchungen mit stabilem Rhythmus"
        />
        <KennCard
          label="Lookback-Fenster"
          wert={`${daten.lookback.von} → ${daten.lookback.bis}`}
          hint="min. 365 Tage, auch außerhalb des Zeitraum-Filters"
        />
      </div>
      <AboRadar abos={daten} onMutiert={ladeDaten} />
    </div>
  );
}

function KennCard({
  label,
  wert,
  hint,
  akzent,
}: {
  label: string;
  wert: string;
  hint?: string;
  akzent?: "negativ" | "positiv";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={
            "mt-1 text-xl font-semibold tabular-nums " +
            (akzent === "negativ"
              ? "text-destructive"
              : akzent === "positiv"
                ? "text-income-strong dark:text-income"
                : "")
          }
        >
          {wert}
        </div>
        {hint ? (
          <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
