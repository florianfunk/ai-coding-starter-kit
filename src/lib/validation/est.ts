// PROJ-10: Zod-Schema für die ESt-Vorschau (GET /api/steuer/est).
// Server-seitige Validierung VOR jedem DB-Zugriff. Alle Parameter optional
// mit sinnvollen Defaults — nur `jahr` ist Pflicht.
import { z } from "zod";

const HEUTE = new Date();
const MIN_JAHR = 2000;
// Abweichendes WJ kann ins Folgejahr reichen → großzügige Obergrenze.
const MAX_JAHR = HEUTE.getFullYear() + 1;

/** Obergrenze für „weitere Einkünfte"/Vorauszahlungen (Plausibilität). */
const MAX_BETRAG = 100_000_000;

/**
 * Query-Parameter für GET /api/steuer/est.
 *
 * Beträge kommen als Strings aus der URL → `z.coerce`. Negative weitere
 * Einkünfte werden bewusst zugelassen (z. B. Verlust aus anderer Quelle),
 * Vorauszahlungen müssen >= 0 sein.
 */
export const estVorschauSchema = z.object({
  jahr: z.coerce
    .number()
    .int("Jahr muss eine ganze Zahl sein.")
    .min(MIN_JAHR, `Jahr muss ≥ ${MIN_JAHR} sein.`)
    .max(MAX_JAHR, `Jahr darf höchstens ${MAX_JAHR} sein.`),
  veranlagung: z
    .enum(["einzel", "zusammen"], {
      message: "Veranlagung muss 'einzel' oder 'zusammen' sein.",
    })
    .default("einzel"),
  weitere_einkuenfte: z.coerce
    .number()
    .min(-MAX_BETRAG, "Wert unrealistisch.")
    .max(MAX_BETRAG, "Wert unrealistisch.")
    .default(0),
  vorauszahlungen: z.coerce
    .number()
    .min(0, "Vorauszahlungen dürfen nicht negativ sein.")
    .max(MAX_BETRAG, "Wert unrealistisch.")
    .default(0),
});

export type EstVorschauInput = z.input<typeof estVorschauSchema>;
export type EstVorschauParsed = z.output<typeof estVorschauSchema>;
