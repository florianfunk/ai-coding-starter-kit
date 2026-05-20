// PROJ-14: Zod-Schemas für die Kategorien-Analyse + Inline-Edit.

import { z } from "zod";

/** ISO-Datum (YYYY-MM-DD) — keine Zeitkomponente, kein Timezone-Drama. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein");

/**
 * Bereichs-Filter: Negativ-Listen-Ansatz.
 * - "geschaeft" → nur Buchungen mit Klassifikation 'geschaeftlich' ODER
 *   Kategorie-Typ 'einnahme' / 'ausgabe' (steuerrelevant für die EÜR).
 * - "privat" → alles, was NICHT geschäftlich ist (privat/unklar/neutral
 *   inkl. ohne Klassifikation).
 * - "alle" → keine Einschränkung (volle Konto-Sicht).
 */
export const bereichSchema = z.enum(["geschaeft", "privat", "alle"]);
export type Bereich = z.infer<typeof bereichSchema>;

/** Filter-Parameter für die Aggregations- und Drill-Down-Endpunkte. */
export const analyseFilterSchema = z
  .object({
    jahr: z.coerce.number().int().min(2000).max(2100).optional(),
    /** Datumsbereich (inkl.). Wenn gesetzt, überschreibt `jahr`. */
    von: isoDate.optional(),
    bis: isoDate.optional(),
    konto_id: z.uuid().optional(),
    bereich: bereichSchema.optional().default("alle"),
    nur_steuerrelevant: z
      .union([z.literal("true"), z.literal("false"), z.boolean()])
      .optional()
      .transform((v) => v === true || v === "true"),
    /** Bei Drill-Down: gezielt eine Kategorie. `null` oder "ohne" = ohne Kategorie. */
    kategorie_id: z.union([z.uuid(), z.literal("ohne")]).optional(),
  })
  .refine((d) => !d.von || !d.bis || d.von <= d.bis, {
    message: "'von' darf nicht nach 'bis' liegen",
    path: ["von"],
  });

export type AnalyseFilter = z.input<typeof analyseFilterSchema>;
export type AnalyseFilterParsed = z.output<typeof analyseFilterSchema>;

/** Inline-Edit einer Buchung (Kategorie, Klassifikation, oder Status-Bestätigen). */
export const buchungPatchSchema = z
  .object({
    kategorie_id: z
      .union([z.uuid(), z.null()])
      .optional()
      .describe("Neue Kategorie-ID oder null (Kategorie entfernen)"),
    klassifikation: z
      .enum(["privat", "geschaeftlich", "unklar", "neutral"])
      .optional(),
    steuerrelevant: z.boolean().optional(),
    ust_satz: z
      .union([z.literal(0), z.literal(7), z.literal(19), z.null()])
      .optional(),
    /**
     * Setzt explizit auf manuell_bestaetigt (Re-Klassifizierung respektiert
     * das). Andere Statuswechsel sind über diesen Endpoint nicht erlaubt.
     */
    bestaetigen: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.kategorie_id !== undefined ||
      d.klassifikation !== undefined ||
      d.steuerrelevant !== undefined ||
      d.ust_satz !== undefined ||
      d.bestaetigen === true,
    { message: "Mindestens ein Feld muss geändert werden" },
  );

export type BuchungPatchInput = z.input<typeof buchungPatchSchema>;
export type BuchungPatchParsed = z.output<typeof buchungPatchSchema>;
