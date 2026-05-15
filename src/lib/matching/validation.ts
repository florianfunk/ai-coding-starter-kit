// PROJ-6: Zod-Schemas für die Abgleich-API (Re-Matching + manuelle Zuordnung).
// Server-seitige Validierung vor jedem DB-Zugriff.
import { z } from "zod";

const isoDatum = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT erwartet");

/**
 * Optionaler Body für POST /api/abgleich (Re-Matching-Lauf).
 *
 * - `nur_offen`: true (Default) = nur Buchungen ohne bestätigte/gesperrte
 *   Zuordnung neu matchen. false = zusätzlich bestehende 'auto'/'unsicher'
 *   Zuordnungen neu berechnen (gesperrte bleiben IMMER unangetastet).
 * - Toleranzen optional konfigurierbar.
 */
export const matchingInputSchema = z.object({
  nur_offen: z.boolean().optional().default(true),
  betrag_abs_toleranz: z
    .number()
    .min(0, "Toleranz darf nicht negativ sein")
    .max(1000, "Toleranz unrealistisch hoch")
    .optional(),
  betrag_rel_toleranz: z
    .number()
    .min(0, "Toleranz darf nicht negativ sein")
    .max(1, "Relative Toleranz max. 1 (=100 %)")
    .optional(),
  datum_fenster_tage: z
    .number()
    .int("Ganze Tage erwartet")
    .min(0, "Fenster darf nicht negativ sein")
    .max(365, "Fenster unrealistisch groß")
    .optional(),
});

export type MatchingInput = z.input<typeof matchingInputSchema>;
export type MatchingParsed = z.output<typeof matchingInputSchema>;

/** Query-Filter für GET /api/abgleich (Fehllisten). */
export const fehllisteFilterSchema = z.object({
  von: isoDatum.optional(),
  bis: isoDatum.optional(),
  konto: z.uuid("Ungültige Konto-ID").optional(),
  betrag_min: z.coerce.number().optional(),
  betrag_max: z.coerce.number().optional(),
});

export type FehllisteFilter = z.output<typeof fehllisteFilterSchema>;

/** POST /api/abgleich/zuordnung — manuelle Verknüpfung anlegen. */
export const zuordnungAnlegenSchema = z.object({
  beleg_id: z.uuid("Ungültige Beleg-ID"),
  buchung_id: z.uuid("Ungültige Buchungs-ID"),
  /**
   * Aktion auf einen vom Agent vorgeschlagenen unsicheren Match:
   * 'bestaetigen' macht ihn zu manuell+gesperrt, 'verwerfen' löscht ihn.
   * Ohne Angabe = frische manuelle Zuordnung (gesperrt).
   */
  aktion: z.enum(["bestaetigen", "verwerfen"]).optional(),
});

export type ZuordnungAnlegen = z.output<typeof zuordnungAnlegenSchema>;

/** DELETE /api/abgleich/zuordnung — Verknüpfung aufheben. */
export const zuordnungLoeschenSchema = z.object({
  id: z.uuid("Ungültige Zuordnungs-ID"),
});

export type ZuordnungLoeschen = z.output<typeof zuordnungLoeschenSchema>;
