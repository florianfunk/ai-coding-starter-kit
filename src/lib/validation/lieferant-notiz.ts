// PROJ-21: Zod-Schemas für Lieferanten-Notizen.

import { z } from "zod";

/** Body für POST /api/finanzen/lieferanten/notizen — Notiz anlegen. */
export const lieferantNotizCreateSchema = z.object({
  empfaenger: z
    .string()
    .trim()
    .min(2, "Empfänger muss mindestens 2 Zeichen haben")
    .max(200),
  inhalt: z
    .string()
    .trim()
    .min(1, "Die Notiz darf nicht leer sein")
    .max(2000, "Die Notiz darf höchstens 2000 Zeichen haben"),
});
export type LieferantNotizCreateInput = z.infer<
  typeof lieferantNotizCreateSchema
>;

/** Body für PATCH /api/finanzen/lieferanten/notizen/[id] — Text ändern. */
export const lieferantNotizUpdateSchema = z.object({
  inhalt: z
    .string()
    .trim()
    .min(1, "Die Notiz darf nicht leer sein")
    .max(2000, "Die Notiz darf höchstens 2000 Zeichen haben"),
});
export type LieferantNotizUpdateInput = z.infer<
  typeof lieferantNotizUpdateSchema
>;
