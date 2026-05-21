// PROJ-17 — Datums-Helfer fuer die Konversations-Liste.
//
// "vor 2 Stunden" / "gestern" / "12.05." / "12.05.2025"

const MINUTE = 60 * 1000;
const STUNDE = 60 * MINUTE;
const TAG = 24 * STUNDE;

/**
 * Formatiert einen ISO-Zeitstempel relativ zu jetzt.
 *
 * - < 1 Min   → "gerade eben"
 * - < 60 Min  → "vor N Min."
 * - < 24 Std  → "vor N Std."
 * - < 2 Tage  → "gestern"
 * - < 7 Tage  → "vor N Tagen"
 * - selbes Jahr → "12.05."
 * - sonst      → "12.05.2024"
 */
export function relativesDatum(iso: string, jetzt: Date = new Date()): string {
  const dann = new Date(iso);
  const diff = jetzt.getTime() - dann.getTime();

  if (diff < MINUTE) return "gerade eben";
  if (diff < STUNDE) {
    const m = Math.floor(diff / MINUTE);
    return `vor ${m} Min.`;
  }
  if (diff < TAG) {
    const h = Math.floor(diff / STUNDE);
    return `vor ${h} Std.`;
  }
  if (diff < 2 * TAG) return "gestern";
  if (diff < 7 * TAG) {
    const d = Math.floor(diff / TAG);
    return `vor ${d} Tagen`;
  }
  const sameYear = dann.getFullYear() === jetzt.getFullYear();
  const tt = String(dann.getDate()).padStart(2, "0");
  const mm = String(dann.getMonth() + 1).padStart(2, "0");
  if (sameYear) return `${tt}.${mm}.`;
  return `${tt}.${mm}.${dann.getFullYear()}`;
}

/** Vollformat: "21.05.2026 14:32" */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
