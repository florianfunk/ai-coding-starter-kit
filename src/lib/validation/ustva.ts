// PROJ-8: Zod-Schemas für USt-Voranmeldung (Perioden-Auswahl & Abschluss).
// Server-seitige Validierung VOR jeder DB-Operation.
import { z } from "zod";

const JAHR_MIN = 2000;
const JAHR_MAX = 2100;

/**
 * Query-Parameter für GET /api/steuer/ust.
 * `periode` = Monat (1..12) | Quartal (1..4) | 0 (Jahresmeldung).
 */
export const ustPeriodeQuerySchema = z.object({
  jahr: z.coerce
    .number()
    .int("Jahr muss eine ganze Zahl sein")
    .min(JAHR_MIN, "Jahr unrealistisch")
    .max(JAHR_MAX, "Jahr unrealistisch"),
  periode: z.coerce
    .number()
    .int("Periode muss eine ganze Zahl sein")
    .min(0, "Periode ungültig")
    .max(12, "Periode ungültig"),
});

/** Body für POST /api/steuer/ust (Periode abschließen → Snapshot einfrieren). */
export const ustAbschlussSchema = z.object({
  jahr: z
    .number()
    .int("Jahr muss eine ganze Zahl sein")
    .min(JAHR_MIN, "Jahr unrealistisch")
    .max(JAHR_MAX, "Jahr unrealistisch"),
  periode: z
    .number()
    .int("Periode muss eine ganze Zahl sein")
    .min(0, "Periode ungültig")
    .max(12, "Periode ungültig"),
});

export type UstPeriodeQuery = z.output<typeof ustPeriodeQuerySchema>;
export type UstAbschluss = z.output<typeof ustAbschlussSchema>;
