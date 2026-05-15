// Zod-Schemas für die Paperless-Integration (PROJ-3).
// Wird sowohl im Client (Formular) als auch im Server (API-Routen) verwendet.
// Felder spiegeln die DB-Tabelle `paperless_verbindung` (supabase/migrations/0001).
import { z } from "zod";

/**
 * Verbindungs-Eingabe: Basis-URL der Paperless-ngx-Instanz + API-Token.
 *
 * - base_url muss eine gültige http(s)-URL sein; trailing slash wird entfernt.
 * - HTTPS wird empfohlen (Steuerdaten), http nur für lokale Instanzen erlaubt.
 * - token ist optional bei PUT: leer = bestehenden Token unverändert lassen.
 */
export const paperlessVerbindungSchema = z.object({
  base_url: z
    .string()
    .trim()
    .min(1, "Basis-URL ist erforderlich")
    .max(500, "Basis-URL ist zu lang (max. 500 Zeichen)")
    .transform((v) => v.replace(/\/+$/, ""))
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    }, "Ungültige URL (Format: https://paperless.example.com)"),

  token: z
    .string()
    .trim()
    .max(500, "Token ist zu lang (max. 500 Zeichen)")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type PaperlessVerbindungInput = z.input<
  typeof paperlessVerbindungSchema
>;
export type PaperlessVerbindungParsed = z.output<
  typeof paperlessVerbindungSchema
>;

/**
 * Optionaler Sync-Filter vor dem Import.
 *
 * - von/bis: ISO-Datum (JJJJ-MM-TT) auf das Paperless-Erstelldatum.
 * - tag: Paperless-Tag-Name (Volltextfilter serverseitig auf Tags).
 * - korrespondent: Paperless-Korrespondent-Name (Volltextfilter).
 */
export const paperlessSyncFilterSchema = z
  .object({
    von: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT erwartet")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    bis: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT erwartet")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    tag: z
      .string()
      .trim()
      .max(120, "Tag ist zu lang (max. 120 Zeichen)")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    korrespondent: z
      .string()
      .trim()
      .max(200, "Korrespondent ist zu lang (max. 200 Zeichen)")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .refine(
    (d) => !(d.von && d.bis) || d.von <= d.bis,
    {
      error: "Das Von-Datum darf nicht nach dem Bis-Datum liegen",
      path: ["bis"],
    },
  );

export type PaperlessSyncFilterInput = z.input<
  typeof paperlessSyncFilterSchema
>;
export type PaperlessSyncFilterParsed = z.output<
  typeof paperlessSyncFilterSchema
>;
