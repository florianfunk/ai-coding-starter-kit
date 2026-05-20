// PROJ-14: Zod-Schemas für die Kategorien-Analyse + Inline-Edit.

import { z } from "zod";

/** Filter-Parameter für die Aggregations- und Drill-Down-Endpunkte. */
export const analyseFilterSchema = z.object({
  jahr: z.coerce.number().int().min(2000).max(2100).optional(),
  konto_id: z.uuid().optional(),
  nur_steuerrelevant: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
  /** Bei Drill-Down: gezielt eine Kategorie. `null` oder "ohne" = ohne Kategorie. */
  kategorie_id: z.union([z.uuid(), z.literal("ohne")]).optional(),
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
