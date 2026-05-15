// PROJ-12: Anzeige-Formatierung fürs Dashboard (rein, ohne JSX).

/** Geldbetrag im deutschen Format mit EUR-Suffix. */
export function formatEuro(n: number): string {
  return `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} €`;
}

/** Ganze Zahl im deutschen Format. */
export function formatZahl(n: number): string {
  return new Intl.NumberFormat("de-DE").format(n);
}

/** ISO-Datum/-Zeitstempel → "dd.mm.yyyy, hh:mm Uhr" (lokale Anzeige). */
export function formatZeitpunkt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const datum = d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const zeit = d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datum}, ${zeit} Uhr`;
}

/** ISO-Datum (yyyy-MM-dd) → "dd.mm.yyyy". */
export function formatDatum(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
