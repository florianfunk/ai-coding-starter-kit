// Zod-Schema für den Klassifizierungs-Trigger (PROJ-5).
// Wird im Client (Aktion) und im Server (API) verwendet.
import { z } from "zod";

/**
 * Optionaler Request-Body für POST /api/klassifizierung.
 *
 * - `nur_offen`: true (Default) = nur Buchungen mit status 'offen'.
 *   false = Re-Klassifizierung aller Buchungen AUSSER 'manuell_bestaetigt'.
 * - `konfidenz_schwellwert`: Mindest-Konfidenz für Auto-Verbuchung.
 * - `betrag_limit`: |Betrag| darüber → immer zur Prüfung (Ausreißer).
 */
export const klassifizierungInputSchema = z.object({
  nur_offen: z.boolean().optional().default(true),
  konfidenz_schwellwert: z
    .number()
    .min(0, "Schwellwert muss zwischen 0 und 1 liegen")
    .max(1, "Schwellwert muss zwischen 0 und 1 liegen")
    .optional()
    .default(0.85),
  betrag_limit: z
    .number()
    .min(0, "Betrags-Limit darf nicht negativ sein")
    .max(1_000_000, "Betrags-Limit unrealistisch hoch")
    .optional()
    .default(2000),
});

export type KlassifizierungInput = z.input<typeof klassifizierungInputSchema>;
export type KlassifizierungParsed = z.output<typeof klassifizierungInputSchema>;
