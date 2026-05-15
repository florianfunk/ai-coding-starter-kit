// Zod-Schema für EÜR-Kontenrahmen-Kategorien (PROJ-2).
// Wird sowohl im Client (Formular) als auch im Server (API) verwendet.
import { z } from "zod";

/** Erlaubte USt-Sätze laut DB-Constraint (numeric in {0,7,19} oder NULL). */
export const UST_SAETZE = [0, 7, 19] as const;

/** Kategorie-Typen (Spiegel des DB-CHECK auf `kategorie.typ`). */
export const KATEGORIE_TYPEN = [
  "einnahme",
  "ausgabe",
  "privat",
  "neutral",
] as const;

/**
 * Eingabeschema einer Kategorie.
 *
 * Konsistenzregel (serverseitig erzwungen):
 * - typ 'privat' oder 'neutral'  → ust_satz MUSS null sein (kein Vorsteuer-/USt-Bezug)
 * - typ 'einnahme' oder 'ausgabe' → ust_satz MUSS in {0, 7, 19} liegen
 */
export const kategorieInputSchema = z
  .object({
    bezeichnung: z
      .string()
      .trim()
      .min(2, "Bezeichnung muss mindestens 2 Zeichen haben")
      .max(120, "Bezeichnung darf höchstens 120 Zeichen haben"),
    typ: z.enum(KATEGORIE_TYPEN, {
      error: "Bitte einen gültigen Typ wählen",
    }),
    // null = kein USt-Bezug; sonst einer der erlaubten Sätze
    ust_satz: z
      .union([z.literal(0), z.literal(7), z.literal(19)])
      .nullable()
      .default(null),
    euer_zeile: z
      .string()
      .trim()
      .max(80, "EÜR-Zeile darf höchstens 80 Zeichen haben")
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    elster_kennzahl: z
      .string()
      .trim()
      .max(20, "ELSTER-Kennzahl darf höchstens 20 Zeichen haben")
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    aktiv: z.boolean().default(true),
    gueltig_ab: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT erwartet")
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .refine(
    (data) => {
      const istOhneUstBezug = data.typ === "privat" || data.typ === "neutral";
      if (istOhneUstBezug) return data.ust_satz === null;
      // einnahme / ausgabe: USt-Satz ist Pflicht und muss gültig sein
      return data.ust_satz !== null && UST_SAETZE.includes(data.ust_satz);
    },
    {
      error:
        "USt-Satz muss zum Typ passen: bei 'Privat'/'Neutral' kein USt-Satz, bei 'Einnahme'/'Ausgabe' ein Satz aus 0/7/19 %.",
      path: ["ust_satz"],
    },
  );

/** Partielles Schema für PUT (Bearbeiten) — alle Felder optional, Regel bleibt. */
export const kategorieUpdateSchema = kategorieInputSchema;

export type KategorieInput = z.input<typeof kategorieInputSchema>;
export type KategorieParsed = z.output<typeof kategorieInputSchema>;
