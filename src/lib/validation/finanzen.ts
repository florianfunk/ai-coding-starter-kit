// Filter-/Pagination-Schema für die chronologische Bewegungen-Sicht.
//
// Baut auf `analyseFilterSchema` auf (Zeitraum, Konto, Bereich), erweitert
// um Empfänger-Suche, Kategorie-Filter und Pagination.

import { z } from "zod";
import { bereichSchema } from "@/lib/validation/kategorien-analyse";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum YYYY-MM-DD");

export const sortFeldSchema = z.enum(["datum", "betrag"]);
export type SortFeld = z.infer<typeof sortFeldSchema>;

export const sortRichtungSchema = z.enum(["asc", "desc"]);
export type SortRichtung = z.infer<typeof sortRichtungSchema>;

export const bewegungenFilterSchema = z
  .object({
    von: isoDate.optional(),
    bis: isoDate.optional(),
    konto_id: z.uuid().optional(),
    bereich: bereichSchema.optional().default("alle"),
    /** Volltext-Suche auf Empfänger + Verwendungszweck. */
    suche: z.string().trim().min(1).max(100).optional(),
    /** Filter auf eine bestimmte Kategorie, "ohne" = ohne Kategorie. */
    kategorie_id: z.union([z.uuid(), z.literal("ohne")]).optional(),
    /** Nur Ausgaben (negativ) bzw. Einnahmen (positiv) - per Vorzeichen. */
    richtung: z.enum(["einnahme", "ausgabe"]).optional(),
    sort: sortFeldSchema.optional().default("datum"),
    richtung_sort: sortRichtungSchema.optional().default("desc"),
    seite: z.coerce.number().int().min(1).optional().default(1),
    pro_seite: z.coerce
      .number()
      .int()
      .min(10)
      .max(500)
      .optional()
      .default(100),
  })
  .refine((d) => !d.von || !d.bis || d.von <= d.bis, {
    message: "'von' darf nicht nach 'bis' liegen",
    path: ["von"],
  });

export type BewegungenFilterParsed = z.output<typeof bewegungenFilterSchema>;
