"use client";

// PROJ-18 — Tab-Wrapper für die Lieferanten-Liste. Lädt die Daten beim
// Mount (und bei Filter-Änderung) und reicht sie an `LieferantenListe`
// weiter. Analog zu abo-radar-tab.tsx.

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { LieferantenListe } from "@/components/kategorien-analyse/lieferanten-liste";
import type { Bereich } from "@/lib/validation/kategorien-analyse";
import type { LieferantenResponse } from "@/app/api/finanzen/lieferanten/route";

export interface LieferantenTabFilter {
  von: string | null;
  bis: string | null;
  kontoId: string | null;
  bereich: Bereich;
  nurSteuerrelevant?: boolean;
}

export function LieferantenTab({
  filter,
  refreshKey,
}: {
  filter: LieferantenTabFilter;
  // PROJ-20-Fix: erzwingt Neuladen (Fokus/Manuell/Zeitraum-Reselect), damit
  // die Analyse nach einem Import nie veralteten Datenstand zeigt.
  refreshKey?: number;
}) {
  const [daten, setDaten] = useState<LieferantenResponse | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ladeDaten = useCallback(() => {
    void refreshKey;
    setFehler(null);
    const params = new URLSearchParams();
    if (filter.von) params.set("von", filter.von);
    if (filter.bis) params.set("bis", filter.bis);
    if (filter.kontoId) params.set("konto_id", filter.kontoId);
    if (filter.bereich !== "alle") params.set("bereich", filter.bereich);
    if (filter.nurSteuerrelevant) params.set("nur_steuerrelevant", "true");
    startTransition(async () => {
      try {
        const r = await fetch(
          `/api/finanzen/lieferanten?${params.toString()}`,
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setDaten((await r.json()) as LieferantenResponse);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        setFehler(msg);
        toast.error("Lieferanten konnten nicht geladen werden: " + msg);
      }
    });
  }, [
    filter.von,
    filter.bis,
    filter.kontoId,
    filter.bereich,
    filter.nurSteuerrelevant,
    refreshKey,
  ]);

  useEffect(() => {
    ladeDaten();
  }, [ladeDaten]);

  if (fehler) {
    return <p className="text-sm text-destructive">{fehler}</p>;
  }
  if (!daten) {
    return (
      <p className="text-sm text-muted-foreground">
        {isPending ? "Lade Lieferanten…" : "Keine Daten."}
      </p>
    );
  }

  return <LieferantenListe daten={daten} onMutiert={ladeDaten} />;
}
