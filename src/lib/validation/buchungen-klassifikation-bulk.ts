// PROJ-18 — Bulk-Klassifikation für viele Buchungen. Eigener Endpoint
// (statt PATCH /api/buchungen/[id] in einer Schleife), damit ein
// einzelner Audit-Eintrag/INSERT-Schwung möglich ist und die UI einen
// einzelnen Toast zeigen kann.

import { z } from "zod";

export const bulkKlassifikationSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1, "Mindestens eine Buchung muss ausgewählt sein")
    .max(500, "Maximal 500 Buchungen auf einmal"),
  klassifikation: z.enum(["privat", "geschaeftlich"]),
});

export type BulkKlassifikationInput = z.input<typeof bulkKlassifikationSchema>;
export type BulkKlassifikationParsed = z.output<
  typeof bulkKlassifikationSchema
>;
