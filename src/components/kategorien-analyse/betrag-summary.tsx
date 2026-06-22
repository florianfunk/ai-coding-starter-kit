"use client";

/**
 * Kleine Zusammenfassung über eine Buchungsliste:
 * Summe positiver Beträge, Summe negativer Beträge und das Netto-Ergebnis.
 * Wird im Kategorie-Drilldown und im Lieferanten-Drilldown verwendet.
 */

function eur(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

interface BetragSummaryProps {
  /** Beträge der (ggf. gefilterten) Buchungen. Vorzeichenbehaftet. */
  betraege: number[];
  className?: string;
}

export function BetragSummary({ betraege, className }: BetragSummaryProps) {
  let positiv = 0;
  let negativ = 0;
  for (const raw of betraege) {
    const n = Number(raw) || 0;
    if (n >= 0) positiv += n;
    else negativ += n;
  }
  const ergebnis = positiv + negativ;

  return (
    <div
      className={`flex flex-col gap-0.5 text-sm tabular-nums ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Positive Beträge:</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {eur(positiv)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Negative Beträge:</span>
        <span className="font-semibold text-destructive">{eur(negativ)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-6 border-t pt-1">
        <span className="font-semibold">Ergebnis:</span>
        <span className="font-semibold">{eur(ergebnis)}</span>
      </div>
    </div>
  );
}
