// Zod-Schema für den Klassifizierungs-Trigger (PROJ-5).
// Wird im Client (Aktion) und im Server (API) verwendet.
import { z } from "zod";

/**
 * PROJ-15 P2 (#1): Obergrenze für eine gezielte Re-Klassifizierung per
 * `buchung_ids`. Schützt sowohl die URL-/Body-Größe als auch die synchrone
 * Hauptschleife (Zeitbudget) vor unbeabsichtigten Massen-Läufen aus einem
 * Multi-Select. Wer mehr will, nutzt den regulären nur_offen=false-Lauf.
 */
export const MAX_BUCHUNG_IDS = 500;

/**
 * Optionaler Request-Body für POST /api/klassifizierung.
 *
 * - `nur_offen`: true (Default) = nur Buchungen mit status 'offen'.
 *   false = Re-Klassifizierung aller Buchungen AUSSER 'manuell_bestaetigt'.
 * - `konfidenz_schwellwert`: Mindest-Konfidenz für Auto-Verbuchung.
 * - `betrag_limit`: |Betrag| darüber → immer zur Prüfung (Ausreißer).
 * - `buchung_ids` (PROJ-15 P2 #1): explizite Auswahl. Wenn gesetzt, werden
 *   NUR diese Buchungen (re-)klassifiziert. `manuell_bestaetigt` bleibt auch
 *   hier ausgeschlossen (Schutz-Invariante der Pipeline). `nur_offen` wird in
 *   diesem Modus ignoriert. Owner-Scoping erfolgt in der Route über
 *   `.eq("owner_id", user.id)`.
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
  buchung_ids: z
    .array(z.uuid("Ungültige Buchungs-ID"))
    .min(1, "Mindestens eine Buchung auswählen")
    .max(MAX_BUCHUNG_IDS, `Maximal ${MAX_BUCHUNG_IDS} Buchungen pro Lauf`)
    .optional(),
});

export type KlassifizierungInput = z.input<typeof klassifizierungInputSchema>;
export type KlassifizierungParsed = z.output<typeof klassifizierungInputSchema>;
