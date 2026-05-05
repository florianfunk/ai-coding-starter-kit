import { z } from "zod";
import { isValidKundenNr } from "./kunden-nr-generator";

export const stammdatenSchema = z.object({
  kunden_nr: z
    .string()
    .min(1)
    .refine(isValidKundenNr, "Format K-NNNN erforderlich (mind. 4 Ziffern)"),
  firma: z.string().min(1, "Firma ist Pflicht").max(200),
  ansprechpartner: z.string().max(200).optional().nullable(),
  email: z
    .union([z.string().email("Ungültige E-Mail"), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  telefon: z.string().max(40).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  strasse: z.string().max(200).optional().nullable(),
  plz: z.string().max(20).optional().nullable(),
  ort: z.string().max(120).optional().nullable(),
  land: z.string().max(120).optional().nullable(),
  standard_filiale: z
    .enum(["lichtengros", "eisenkeil"])
    .nullable()
    .optional(),
  notizen: z.string().max(2000).optional().nullable(),
  status: z.enum(["aktiv", "archiviert"]).default("aktiv"),
  branche_ids: z.array(z.string().uuid()).default([]),
});

export const preiseSchema = z.object({
  preis_spur: z.enum(["lichtengros", "eisenkeil", "listenpreis"]),
  aufschlag_vorzeichen: z.enum(["plus", "minus"]),
  aufschlag_pct: z.coerce.number().min(0).max(100),
});

export const auswahlSchema = z.object({
  alle_produkte: z.boolean(),
  produkt_ids: z.array(z.string().uuid()),
});

export const brancheSchema = z.object({
  name: z.string().min(1, "Name ist Pflicht").max(80),
});

export const datenblattJobSchema = z.object({
  kunde_id: z.string().uuid(),
  produkt_id: z.string().uuid(),
});
