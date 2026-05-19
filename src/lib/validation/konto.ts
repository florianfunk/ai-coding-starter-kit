// Zod-Schemas für Bankkonten + Mapping-Vorlage + Import-Request (PROJ-4).
// Wird im Client (Formular) und im Server (API) verwendet.
import { z } from "zod";

/** Konto-Typen (Spiegel des DB-CHECK auf `konto.typ`). */
export const KONTO_TYPEN = ["bank", "paypal", "kreditkarte"] as const;

/** Zulässige Datumsformate für die Mapping-Vorlage. */
export const DATUM_FORMATE = ["auto", "DE", "US", "ISO"] as const;

/**
 * Spalten→Feld-Mapping-Vorlage eines Kontos.
 *
 * Pflicht: `datum` und `betrag` (eindeutige Mindest-Identifikation einer
 * Buchung). Optional: Verwendungszweck, Empfänger, Währung sowie ein Flag,
 * ob das Betragsvorzeichen invertiert werden muss (manche Kreditkarten-/
 * PayPal-Exporte führen Ausgaben positiv).
 */
export const kontoMappingSchema = z.object({
  datum: z
    .string()
    .trim()
    .min(1, "Spaltenname für Datum ist erforderlich")
    .max(120, "Spaltenname zu lang"),
  betrag: z
    .string()
    .trim()
    .min(1, "Spaltenname für Betrag ist erforderlich")
    .max(120, "Spaltenname zu lang"),
  verwendungszweck: z
    .string()
    .trim()
    .max(120, "Spaltenname zu lang")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  empfaenger: z
    .string()
    .trim()
    .max(120, "Spaltenname zu lang")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  waehrung: z
    .string()
    .trim()
    .max(120, "Spaltenname zu lang")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  betrag_vorzeichen_invertieren: z.boolean().optional().default(false),
  datum_format: z.enum(DATUM_FORMATE).optional().default("auto"),
});

/** Eingabeschema für Konto-Anlage (POST) und -Bearbeitung (PUT). */
export const kontoInputSchema = z.object({
  bezeichnung: z
    .string()
    .trim()
    .min(2, "Bezeichnung muss mindestens 2 Zeichen haben")
    .max(120, "Bezeichnung darf höchstens 120 Zeichen haben"),
  typ: z.enum(KONTO_TYPEN, {
    error: "Bitte einen gültigen Kontotyp wählen",
  }),
  // Mapping ist beim Anlegen optional (kann beim ersten Import gesetzt werden).
  mapping: kontoMappingSchema.nullable().optional().default(null),
});

/** PUT verwendet dasselbe Schema (alle Felder erforderlich außer Mapping). */
export const kontoUpdateSchema = kontoInputSchema;

/**
 * Import-Request-Metadaten (kommt als FormData-Felder, nicht als JSON-Body).
 * Die eigentliche Datei wird separat aus dem FormData gelesen.
 */
export const importRequestSchema = z.object({
  konto_id: z.uuid("Ungültige Konto-ID"),
  // Optionales Ad-hoc-Mapping (überschreibt das gespeicherte Konto-Mapping
  // für genau diesen Import, z. B. beim Ersteinrichten).
  mapping: kontoMappingSchema.nullable().optional().default(null),
  // Nur Vorschau (kein DB-Insert)
  preview: z.boolean().optional().default(false),
});

export type KontoMappingInput = z.input<typeof kontoMappingSchema>;
export type KontoMappingParsed = z.output<typeof kontoMappingSchema>;
export type KontoInput = z.input<typeof kontoInputSchema>;
export type KontoParsed = z.output<typeof kontoInputSchema>;
export type ImportRequestParsed = z.output<typeof importRequestSchema>;
