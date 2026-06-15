// PROJ-18 — Bulk-USt-Satz für viele Buchungen. Eigener Endpoint (statt
// PATCH /api/buchungen/[id] in einer Schleife), damit ein einzelner
// Audit-Schwung möglich ist und die UI einen Toast zeigen kann.

import { z } from "zod";

export const bulkUstSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1, "Mindestens eine Buchung muss ausgewählt sein")
    .max(500, "Maximal 500 Buchungen auf einmal"),
  // 0 / 7 / 19 oder null ("kein USt-Satz" für neutrale/private Posten).
  ust_satz: z.union([z.literal(0), z.literal(7), z.literal(19), z.null()]),
});

export type BulkUstInput = z.input<typeof bulkUstSchema>;
export type BulkUstParsed = z.output<typeof bulkUstSchema>;
