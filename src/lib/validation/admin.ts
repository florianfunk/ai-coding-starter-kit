// Zod-Schemas für den Adminbereich (PROJ-13).
// Wird sowohl im Client (Formular) als auch im Server (API-Routen) verwendet.
import { z } from "zod";

/**
 * KI-Einstellungen: AI-Gateway-Key (optional bei PUT — leer = unverändert)
 * + Modell-Bezeichnung.
 *
 * - ai_key ist optional: leer lassen behält den bestehenden Key (wie das
 *   Paperless-Token-Pattern).
 * - ai_model muss nicht-leer sein (z. B. "anthropic/claude-haiku-4-5").
 */
export const aiEinstellungSchema = z.object({
  ai_key: z
    .string()
    .trim()
    .max(500, "Key ist zu lang (max. 500 Zeichen)")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  ai_model: z
    .string()
    .trim()
    .min(1, "Modell ist erforderlich")
    .max(200, "Modell ist zu lang (max. 200 Zeichen)"),
});

export type AiEinstellungInput = z.input<typeof aiEinstellungSchema>;
export type AiEinstellungParsed = z.output<typeof aiEinstellungSchema>;

/**
 * Passwortänderung: aktuelles Passwort (für Re-Auth) + neues Passwort.
 * Mindestlänge des neuen Passworts: 8 Zeichen.
 */
export const passwortAendernSchema = z.object({
  aktuelles_passwort: z
    .string()
    .min(1, "Aktuelles Passwort ist erforderlich")
    .max(200, "Passwort ist zu lang (max. 200 Zeichen)"),
  neues_passwort: z
    .string()
    .min(8, "Neues Passwort muss mindestens 8 Zeichen haben")
    .max(200, "Passwort ist zu lang (max. 200 Zeichen)"),
});

export type PasswortAendernInput = z.input<typeof passwortAendernSchema>;
export type PasswortAendernParsed = z.output<typeof passwortAendernSchema>;

/**
 * E-Mail-Änderung: aktuelles Passwort (für Re-Auth) + neue E-Mail.
 * Die tatsächliche Umstellung passiert erst nach Klick auf den
 * Bestätigungslink, den Supabase an die neue Adresse schickt.
 */
export const emailAendernSchema = z.object({
  aktuelles_passwort: z
    .string()
    .min(1, "Aktuelles Passwort ist erforderlich")
    .max(200, "Passwort ist zu lang (max. 200 Zeichen)"),
  neue_email: z
    .email("Bitte eine gültige E-Mail-Adresse eingeben")
    .trim()
    .toLowerCase()
    .max(254, "E-Mail-Adresse ist zu lang (max. 254 Zeichen)"),
});

export type EmailAendernInput = z.input<typeof emailAendernSchema>;
export type EmailAendernParsed = z.output<typeof emailAendernSchema>;

/** Erlaubte Wartungsaktionen (owner-scoped, irreversibel). */
export const WARTUNG_AKTIONEN = [
  "buchungen_reset",
  "belege_reset",
  "kontenrahmen_reseed",
] as const;

export type WartungAktion = (typeof WARTUNG_AKTIONEN)[number];

/**
 * Pro Aktion eine exakte Bestätigungsphrase, die der Nutzer eintippen muss.
 * Schutz gegen versehentliche (oder per CSRF/Skript ausgelöste) irreversible
 * Löschaktionen: ein bloßer Klick reicht nicht, die Phrase muss exakt stimmen.
 */
export const WARTUNG_BESTAETIGUNG: Record<WartungAktion, string> = {
  buchungen_reset: "BUCHUNGEN LÖSCHEN",
  belege_reset: "BELEGE LÖSCHEN",
  kontenrahmen_reseed: "KONTENRAHMEN LEEREN",
};

/**
 * Daten-Wartung: genau eine typisierte Reset-Aktion + exakte
 * Bestätigungsphrase (Schutz vor irreversiblen Fehlauslösungen).
 */
export const wartungSchema = z
  .object({
    aktion: z.enum(WARTUNG_AKTIONEN, {
      message: "Unbekannte Wartungsaktion",
    }),
    bestaetigung: z
      .string()
      .min(1, "Bestätigungsphrase ist erforderlich")
      .max(100, "Bestätigungsphrase ist zu lang"),
  })
  .refine((d) => d.bestaetigung.trim() === WARTUNG_BESTAETIGUNG[d.aktion], {
    error: "Bestätigungsphrase stimmt nicht. Bitte exakt wie angezeigt eintippen.",
    path: ["bestaetigung"],
  });

export type WartungInput = z.input<typeof wartungSchema>;
export type WartungParsed = z.output<typeof wartungSchema>;
