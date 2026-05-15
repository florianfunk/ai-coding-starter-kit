// PROJ-9: Zod-Schemata für die Jahres-EÜR.
// Genutzt im Client (Aktion) und Server (API-Route, Validierung vor DB).
import { z } from "zod";

const HEUTE = new Date();
const MIN_JAHR = 2000;
// Großzügige Obergrenze (abweichendes WJ kann ins Folgejahr reichen).
const MAX_JAHR = HEUTE.getFullYear() + 1;

/** Wirtschaftsjahr-Auswahl (GET /api/steuer/euer?jahr=YYYY). */
export const euerJahrSchema = z.object({
  jahr: z.coerce
    .number()
    .int("Jahr muss eine ganze Zahl sein.")
    .min(MIN_JAHR, `Jahr muss ≥ ${MIN_JAHR} sein.`)
    .max(MAX_JAHR, `Jahr darf höchstens ${MAX_JAHR} sein.`),
});

/** Jahresabschluss-Request (POST /api/steuer/euer). */
export const euerAbschlussSchema = z.object({
  jahr: z.coerce
    .number()
    .int("Jahr muss eine ganze Zahl sein.")
    .min(MIN_JAHR, `Jahr muss ≥ ${MIN_JAHR} sein.`)
    .max(MAX_JAHR, `Jahr darf höchstens ${MAX_JAHR} sein.`),
  // Pflicht-Bestätigung: schützt vor versehentlichem Einfrieren.
  bestaetigt: z.literal(true, {
    message: "Der Abschluss muss ausdrücklich bestätigt werden.",
  }),
});

export type EuerJahrInput = z.input<typeof euerJahrSchema>;
export type EuerJahrParsed = z.output<typeof euerJahrSchema>;
export type EuerAbschlussInput = z.input<typeof euerAbschlussSchema>;
export type EuerAbschlussParsed = z.output<typeof euerAbschlussSchema>;
