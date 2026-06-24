// PROJ-32 (AC1): Reine, voll testbare Auswahl-Logik für Fristen-Erinnerungen.
//
// Entscheidet aus einer bereits berechneten USt-VA-Frist (UstFristInfo aus
// PROJ-27, src/lib/dashboard/fristen.ts) und der Menge bereits versendeter
// Erinnerungen (Schlüssel `periode_key + stufe`), OB und mit welcher STUFE eine
// E-Mail fällig ist.
//
// Idempotent: pro (periode_key, stufe) wird höchstens eine Erinnerung fällig.
// KEINE DB-, Mail- oder UI-Abhängigkeit — diese Logik ist rein und einzeln
// getestet.

import type { UstFristInfo } from "@/lib/dashboard/fristen";

/** Erinnerungs-Stufen, von früh nach spät. */
export type ErinnerungStufe = "14_tage" | "3_tage" | "ueberfaellig";

/** Eine fällige Erinnerung (Stufe + stabiler Idempotenz-Schlüssel). */
export interface FaelligeErinnerung {
  stufe: ErinnerungStufe;
  /** Stabiler Perioden-Schlüssel, z. B. "2026-3" (jahr-periode). */
  periode_key: string;
}

/**
 * Stabiler Perioden-Schlüssel aus der Frist-Info: `${jahr}-${periode}`.
 * Identisch zum Schema, das `naechsteUstFrist` intern für abgeschlossene
 * Perioden verwendet — so bleibt der Schlüssel über Läufe hinweg konstant.
 */
export function periodeKey(frist: UstFristInfo): string {
  return `${frist.periode.jahr}-${frist.periode.periode}`;
}

/**
 * Leitet die dringlichste Stufe ab, die für die gegebene Frist GRUNDSÄTZLICH
 * (ohne Idempotenz) passt, oder null bei neutraler Ampel.
 *
 * Ableitung strikt aus ampel/tage_bis_frist/ueberfaellig (PROJ-27):
 *   - ueberfaellig                       → "ueberfaellig"
 *   - rote Ampel (tage_bis_frist <= 3)   → "3_tage"
 *   - gelbe Ampel (4..14 Tage)           → "14_tage"
 *   - neutral (> 14 Tage)                → null (keine Mail)
 */
function passendeStufe(frist: UstFristInfo): ErinnerungStufe | null {
  if (frist.ueberfaellig) return "ueberfaellig";
  if (frist.ampel === "rot") return "3_tage";
  if (frist.ampel === "gelb") return "14_tage";
  return null;
}

/**
 * Bestimmt die fällige Erinnerung für die aktuelle Frist oder null.
 *
 * @param frist   Nächste USt-VA-Frist (oder null → keine Frist → null).
 * @param gesendet Set bereits versendeter Schlüssel im Format
 *                 `${periode_key}::${stufe}`.
 * @returns Die fällige Erinnerung (Stufe + periode_key) oder null, wenn
 *          nichts (mehr) fällig ist (neutral ODER bereits versendet).
 *
 * Idempotenz: Wurde die passende Stufe für diese Periode bereits versendet,
 * liefert die Funktion null — der tägliche Cron sendet dann nicht erneut.
 * Jede Stufe wird so pro Periode genau einmal ausgelöst.
 */
export function bestimmeFaelligeErinnerung(
  frist: UstFristInfo | null,
  gesendet: ReadonlySet<string>,
): FaelligeErinnerung | null {
  if (!frist) return null;

  const stufe = passendeStufe(frist);
  if (!stufe) return null;

  const key = periodeKey(frist);
  if (gesendet.has(idempotenzSchluessel(key, stufe))) return null;

  return { stufe, periode_key: key };
}

/** Baut den Idempotenz-Schlüssel aus periode_key + stufe. */
export function idempotenzSchluessel(
  periodeKey: string,
  stufe: ErinnerungStufe,
): string {
  return `${periodeKey}::${stufe}`;
}
