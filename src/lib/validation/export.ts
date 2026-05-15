// PROJ-11: Zod-Schema für Export-Requests.
// Serverseitige Validierung VOR jedem DB-Zugriff (GET-Query & POST-Body).
import { z } from "zod";

const JAHR_MIN = 2000;
const JAHR_MAX = 2100;

/** Was exportiert wird. */
export const EXPORT_TYPEN = [
  "euer", // Jahres-EÜR-Aufstellung
  "ustva", // USt-Voranmeldung (Periode)
  "privatentnahmen", // dedizierter Privatentnahmen-Export (privat!)
  "buchungen", // CSV/DATEV-ähnlicher Buchungsexport
  "elster", // ELSTER-Kennzahlen (USt-VA)
] as const;
export type ExportTyp = (typeof EXPORT_TYPEN)[number];

/** Ausgabeformat. */
export const EXPORT_FORMATE = ["pdf", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATE)[number];

/**
 * Welche Format-Kombinationen je Typ zulässig sind.
 * - EÜR/USt-VA/Privatentnahmen-Aufstellung: PDF.
 * - Buchungsexport: CSV.
 * - ELSTER-Kennzahlen: PDF oder CSV.
 */
const ERLAUBTE_FORMATE: Record<ExportTyp, readonly ExportFormat[]> = {
  euer: ["pdf"],
  ustva: ["pdf"],
  privatentnahmen: ["pdf"],
  buchungen: ["csv"],
  elster: ["pdf", "csv"],
};

const jahrSchema = z.coerce
  .number()
  .int("Jahr muss eine ganze Zahl sein.")
  .min(JAHR_MIN, `Jahr muss ≥ ${JAHR_MIN} sein.`)
  .max(JAHR_MAX, `Jahr darf höchstens ${JAHR_MAX} sein.`);

// periode: Monat 1..12 / Quartal 1..4 / 0 = Jahresmeldung.
const periodeSchema = z.coerce
  .number()
  .int("Periode muss eine ganze Zahl sein.")
  .min(0, "Periode ungültig.")
  .max(12, "Periode ungültig.");

/**
 * Export-Request. `periode` ist nur für `ustva`/`elster` relevant
 * (USt-VA-Zeitraum); für `euer`/`buchungen`/`privatentnahmen` wird das
 * ganze Wirtschaftsjahr/Jahr verwendet.
 */
export const exportRequestSchema = z
  .object({
    typ: z.enum(EXPORT_TYPEN, { message: "Unbekannter Export-Typ." }),
    format: z.enum(EXPORT_FORMATE, { message: "Unbekanntes Format." }),
    jahr: jahrSchema,
    periode: periodeSchema.optional(),
  })
  .superRefine((d, ctx) => {
    if (!ERLAUBTE_FORMATE[d.typ].includes(d.format)) {
      ctx.addIssue({
        code: "custom",
        path: ["format"],
        message: `Format „${d.format}" ist für den Typ „${d.typ}" nicht zulässig.`,
      });
    }
    if (
      (d.typ === "ustva" || d.typ === "elster") &&
      d.periode === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["periode"],
        message: "Für USt-VA-/ELSTER-Export ist eine Periode erforderlich.",
      });
    }
  });

export type ExportRequestInput = z.input<typeof exportRequestSchema>;
export type ExportRequest = z.output<typeof exportRequestSchema>;

/** Erlaubte Formate je Typ (für die UI, damit Auswahl konsistent ist). */
export function erlaubteFormate(typ: ExportTyp): readonly ExportFormat[] {
  return ERLAUBTE_FORMATE[typ];
}
