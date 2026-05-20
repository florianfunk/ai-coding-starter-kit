// Schema für Bulk-Operationen auf Buchungen (PROJ-14).
// Bewusst klein gehalten: ein Endpoint pro Operation, keine
// generische "patch viele"-Schnittstelle.

import { z } from "zod";

/**
 * Bulk-Kategoriewechsel: gleiche Kategorie für viele Buchungen, jede
 * Buchung wird gleichzeitig auf `manuell_bestaetigt` gesetzt (damit die
 * Re-Klassifizierung sie nicht überschreibt). Pro Aufruf max 500 IDs —
 * das limitiert sowohl Audit-Schreibmenge als auch UI-Erwartungen.
 */
export const bulkKategorieSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1, "Mindestens eine Buchung muss ausgewählt sein")
    .max(500, "Maximal 500 Buchungen auf einmal"),
  kategorie_id: z.uuid(),
});

export type BulkKategorieInput = z.input<typeof bulkKategorieSchema>;
export type BulkKategorieParsed = z.output<typeof bulkKategorieSchema>;
