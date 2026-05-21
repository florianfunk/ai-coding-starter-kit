// PROJ-16 — Zod-Schemas fuer Mein Profil (Arbeitgeber, Familie, Adresse,
// Konto-Eigentum-Toggle).
//
// `name_normalisiert` ist NICHT Bestandteil der Schemas — wird in den API-
// Routen serverseitig automatisch via `normalisiereEmpfaenger(name)` gesetzt.
// Damit kann niemand einen falschen Schluessel durchschmuggeln.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Helpers (Zod v4 verhaelt sich bei .optional().default() teils ueberraschend)
// ---------------------------------------------------------------------------

const datumOptional = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const s = v.trim();
    return s.length > 0 ? s : null;
  })
  .refine(
    (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
    "Ungültiges Datum (Format: JJJJ-MM-TT)",
  );

const notizOptional = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const s = v.trim();
    if (s.length === 0) return null;
    if (s.length > 500) return s.slice(0, 500);
    return s;
  });

// ---------------------------------------------------------------------------
// Arbeitgeber
// ---------------------------------------------------------------------------

export const arbeitgeberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name ist erforderlich")
    .max(120, "Name darf höchstens 120 Zeichen haben"),
  aktiv_von: datumOptional,
  aktiv_bis: datumOptional,
  notiz: notizOptional,
});

export const arbeitgeberUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name ist erforderlich")
    .max(120, "Name darf höchstens 120 Zeichen haben")
    .optional(),
  aktiv_von: datumOptional,
  aktiv_bis: datumOptional,
  notiz: notizOptional,
});

export type ArbeitgeberInput = z.input<typeof arbeitgeberSchema>;
export type ArbeitgeberParsed = z.output<typeof arbeitgeberSchema>;
export type ArbeitgeberUpdateInput = z.input<typeof arbeitgeberUpdateSchema>;
export type ArbeitgeberUpdateParsed = z.output<typeof arbeitgeberUpdateSchema>;

// ---------------------------------------------------------------------------
// Familie
// ---------------------------------------------------------------------------

export const FAMILIE_ROLLEN = [
  "ehepartner",
  "kind",
  "eltern",
  "sonstige",
] as const;

export type FamilieRolle = (typeof FAMILIE_ROLLEN)[number];

export const familieSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name ist erforderlich")
    .max(120, "Name darf höchstens 120 Zeichen haben"),
  rolle: z.enum(FAMILIE_ROLLEN, {
    message: "Bitte eine gültige Rolle wählen",
  }),
  auch_geschaeftspartner: z.boolean().optional().default(false),
  notiz: notizOptional,
});

export const familieUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name ist erforderlich")
    .max(120, "Name darf höchstens 120 Zeichen haben")
    .optional(),
  rolle: z
    .enum(FAMILIE_ROLLEN, { message: "Bitte eine gültige Rolle wählen" })
    .optional(),
  auch_geschaeftspartner: z.boolean().optional(),
  notiz: notizOptional,
});

export type FamilieInput = z.input<typeof familieSchema>;
export type FamilieParsed = z.output<typeof familieSchema>;
export type FamilieUpdateInput = z.input<typeof familieUpdateSchema>;
export type FamilieUpdateParsed = z.output<typeof familieUpdateSchema>;

// ---------------------------------------------------------------------------
// Adresse (PUT - upsert auf Single-Row)
// ---------------------------------------------------------------------------

const textOptionalMax = (max: number, label: string) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined) return null;
      const s = v.trim();
      return s.length > 0 ? s : null;
    })
    .refine((v) => v === null || v.length <= max, `${label} ist zu lang`);

export const adresseSchema = z.object({
  strasse: textOptionalMax(200, "Straße"),
  plz: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined) return null;
      const s = v.trim();
      return s.length > 0 ? s : null;
    })
    .refine(
      (v) => v === null || /^\d{4,5}$/u.test(v),
      "PLZ muss 4 oder 5 Ziffern haben",
    ),
  ort: textOptionalMax(120, "Ort"),
  land: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined) return "DE";
      const s = v.trim();
      return s.length > 0 ? s.toUpperCase() : "DE";
    })
    .refine(
      (v) => v.length >= 2 && v.length <= 3,
      "Länderkürzel muss 2 oder 3 Zeichen haben",
    ),
});

export type AdresseInput = z.input<typeof adresseSchema>;
export type AdresseParsed = z.output<typeof adresseSchema>;

// ---------------------------------------------------------------------------
// Konto: Toggle "ist_eigenes_konto"
// ---------------------------------------------------------------------------

export const kontoEigenesSchema = z.object({
  ist_eigenes_konto: z.boolean(),
});

export type KontoEigenesParsed = z.output<typeof kontoEigenesSchema>;
