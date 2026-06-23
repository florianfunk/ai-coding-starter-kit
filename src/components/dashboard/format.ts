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

/**
 * ISO-Zeitstempel → relativer deutscher Zeitstempel ("vor 2 Std",
 * "gestern", "vor 3 Tagen"). `jetzt` als Parameter (Default: Date.now())
 * macht die Funktion testbar. Fällt bei ungültigem Input auf den
 * absoluten Zeitpunkt zurück.
 */
export function formatRelativeZeit(
  iso: string | null,
  jetzt: number = Date.now(),
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return iso;

  const diffMs = jetzt - t;
  const diffSek = Math.round(diffMs / 1000);

  // Zukunft oder gerade eben.
  if (diffSek < 60) return "gerade eben";

  const diffMin = Math.round(diffSek / 60);
  if (diffMin < 60) return `vor ${diffMin} Min`;

  const diffStd = Math.round(diffMin / 60);
  if (diffStd < 24) return `vor ${diffStd} Std`;

  const diffTage = Math.round(diffStd / 24);
  if (diffTage === 1) return "gestern";
  if (diffTage < 7) return `vor ${diffTage} Tagen`;
  if (diffTage < 14) return "vor 1 Woche";
  if (diffTage < 30) return `vor ${Math.round(diffTage / 7)} Wochen`;

  // Älter als ~1 Monat → absolutes Datum.
  return formatZeitpunkt(iso);
}
