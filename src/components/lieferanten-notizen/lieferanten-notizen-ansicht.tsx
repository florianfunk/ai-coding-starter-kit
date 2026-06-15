"use client";

// PROJ-21 — Übersichtsseite aller Lieferanten-Notizen. Pro Lieferant eine
// Karte mit dem wiederverwendbaren Notiz-Panel (vorab serverseitig geladen).
// Sinkt die Notiz-Anzahl eines Lieferanten auf 0, verschwindet die Karte.

import { useState } from "react";
import { StickyNote } from "lucide-react";

import { LieferantNotizenPanel } from "@/components/lieferanten-notizen/lieferant-notizen-panel";
import type { LieferantNotizGruppe } from "@/lib/finanzen/lieferant-notizen";

function deDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export function LieferantenNotizenAnsicht({
  initialGruppen,
}: {
  initialGruppen: LieferantNotizGruppe[];
}) {
  const [gruppen, setGruppen] = useState<LieferantNotizGruppe[]>(
    initialGruppen,
  );

  function setzeAnzahl(norm: string, anzahl: number) {
    if (anzahl > 0) return;
    // Letzte Notiz dieses Lieferanten entfernt → Karte ausblenden.
    setGruppen((gs) => gs.filter((g) => g.empfaenger_norm !== norm));
  }

  if (gruppen.length === 0) {
    return (
      <section className="rounded-[var(--radius)] bg-card px-8 py-16 text-center shadow-[var(--shadow-1)] ring-1 ring-line/60">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-tint-yellow text-highlight-strong">
          <StickyNote className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold tracking-[-0.012em]">
          Noch keine Lieferanten-Notizen
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-muted-foreground">
          Leg im Lieferanten-Tab der Kategorien-Analyse beim Aufklappen eines
          Lieferanten eine Notiz an — z. B. zu welcher Software oder Lizenz
          seine Abbuchungen gehören.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-1 text-[12px] text-muted-foreground">
        {gruppen.length}{" "}
        {gruppen.length === 1 ? "Lieferant" : "Lieferanten"} mit Notizen
      </div>
      {gruppen.map((g) => (
        <section
          key={g.empfaenger_norm}
          className="rounded-[var(--radius)] bg-card p-4 shadow-[var(--shadow-1)] ring-1 ring-line/60"
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="truncate font-display text-lg font-bold tracking-[-0.012em]">
              {g.empfaenger_anzeige}
            </h2>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              zuletzt {deDateTime(g.zuletzt_am)}
            </span>
          </div>
          <LieferantNotizenPanel
            empfaengerNorm={g.empfaenger_norm}
            empfaengerName={g.empfaenger_anzeige}
            initialNotizen={g.notizen}
            onCountChange={(n) => setzeAnzahl(g.empfaenger_norm, n)}
          />
        </section>
      ))}
    </div>
  );
}
