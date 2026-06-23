"use client";

// PROJ-26 (Feature 3): Inline-"Warum?"-Begründung. Klappt unter einer Prüflisten-
// Zeile die Entscheidungsbasis des Agenten auf — Begründung, Konfidenz-Balken,
// Quelle und Prüfgründe. Nutzt ausschließlich Felder, die bereits in der Buchung
// stecken (kein zusätzlicher Datenfetch).

import type { Buchung } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { grundLabel, gruendeListe } from "./labels";

// Quelle-Klartext. Der TS-Typ kennt nur regel/ki/manuell/null, in der DB können
// aber auch vorjahr/cache stehen — daher tolerant über einen String-Lookup.
const QUELLE_LABEL: Record<string, string> = {
  regel: "Lernregel",
  ki: "KI",
  manuell: "Manuell",
  vorjahr: "Vorjahres-Übernahme",
  cache: "Aus früherer Korrektur",
};

function quelleLabel(quelle: string | null): string {
  if (!quelle) return "—";
  return QUELLE_LABEL[quelle] ?? quelle;
}

export function PrueflisteBegruendung({ fall }: { fall: Buchung }) {
  const gruende = gruendeListe(fall.pruef_grund);
  const hatKonfidenz = fall.konfidenz !== null && fall.konfidenz !== undefined;
  const prozent = hatKonfidenz ? Math.round((fall.konfidenz ?? 0) * 100) : 0;

  return (
    <div
      id={`begruendung-${fall.id}`}
      className="space-y-3 border-t border-line-hair bg-[color:var(--surface-2)] px-4 py-3 text-[12px] text-muted-foreground"
    >
      {/* Begründung */}
      <div className="space-y-0.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
          Begründung
        </div>
        <p className="text-[12.5px] leading-snug text-foreground">
          {fall.begruendung?.trim()
            ? fall.begruendung
            : "Keine Begründung hinterlegt."}
        </p>
      </div>

      {/* Konfidenz */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
            Konfidenz
          </span>
          <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
            {hatKonfidenz ? `${prozent} %` : "KI nicht verfügbar"}
          </span>
        </div>
        {hatKonfidenz && (
          <Progress value={prozent} className="h-1.5 bg-line/60" />
        )}
      </div>

      {/* Quelle + Prüfgründe */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
            Quelle
          </span>
          <span className="text-[12px] font-medium text-foreground">
            {quelleLabel(fall.quelle)}
          </span>
        </div>
        {gruende.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
              Prüfgründe
            </span>
            {gruende.map((g) => (
              <span
                key={g}
                className="inline-flex items-center rounded-full bg-tint-cerise px-2 py-0 text-[10px] font-semibold text-destructive"
              >
                {grundLabel(g)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
