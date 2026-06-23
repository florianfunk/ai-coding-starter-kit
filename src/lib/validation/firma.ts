// Gemeinsames Zod-Schema für das Firmen-/Steuerprofil (PROJ-1).
// Wird sowohl client- (react-hook-form) als auch serverseitig (API-Route) genutzt.
// Felder spiegeln die DB-Tabelle `firmenprofil` (supabase/migrations/0001).

import { z } from "zod";

// Deutsche Steuernummer: 10–13 Ziffern, optional mit Trennern (/ . -).
// Beispiele: 12345/67890, 1234567890, 123/456/78901
const STEUERNUMMER_REGEX = /^\d{2,4}([/.-]?\d{2,5}){1,3}$/;

// USt-IdNr. (Deutschland): "DE" + 9 Ziffern. Whitespace wird vorab entfernt.
const UST_IDNR_REGEX = /^DE\d{9}$/;

// PLZ (Deutschland): genau 5 Ziffern.
const PLZ_REGEX = /^\d{5}$/;

/** Leerstring -> undefined (optionale Felder bleiben "leer" statt "ungültig"). */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const firmenprofilSchema = z.object({
  firmenname: z
    .string()
    .trim()
    .min(1, "Firmenname ist erforderlich")
    .max(200, "Firmenname ist zu lang (max. 200 Zeichen)"),

  inhaber: z
    .string()
    .trim()
    .min(1, "Inhaber ist erforderlich")
    .max(200, "Name des Inhabers ist zu lang (max. 200 Zeichen)"),

  steuernummer: optionalText.refine(
    (v) => v === undefined || STEUERNUMMER_REGEX.test(v),
    "Ungültiges Steuernummer-Format (z. B. 12345/67890)",
  ),

  ust_idnr: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .refine(
      (v) => v === undefined || UST_IDNR_REGEX.test(v),
      "Ungültige USt-IdNr. (Format: DE + 9 Ziffern, z. B. DE123456789)",
    ),

  strasse: optionalText.refine(
    (v) => v === undefined || v.length <= 200,
    "Straße ist zu lang (max. 200 Zeichen)",
  ),

  plz: optionalText.refine(
    (v) => v === undefined || PLZ_REGEX.test(v),
    "Ungültige PLZ (genau 5 Ziffern)",
  ),

  ort: optionalText.refine(
    (v) => v === undefined || v.length <= 100,
    "Ort ist zu lang (max. 100 Zeichen)",
  ),

  finanzamt: optionalText.refine(
    (v) => v === undefined || v.length <= 150,
    "Finanzamt ist zu lang (max. 150 Zeichen)",
  ),

  rechtsform: z.enum(["einzelunternehmer", "freiberufler"], {
    message: "Bitte eine Rechtsform wählen",
  }),

  ust_status: z.enum(["regelbesteuerung", "kleinunternehmer"], {
    message: "Bitte einen USt-Status wählen",
  }),

  wirtschaftsjahr_beginn: z.coerce
    .number()
    .int("Monat muss eine ganze Zahl sein")
    .min(1, "Monat zwischen 1 und 12")
    .max(12, "Monat zwischen 1 und 12"),

  ust_va_rhythmus: z.enum(
    ["monatlich", "quartalsweise", "jaehrlich"],
    { message: "Bitte einen USt-VA-Rhythmus wählen" },
  ),

  rhythmus_gueltig_ab: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .refine(
      (v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v),
      "Ungültiges Datum (Format: JJJJ-MM-TT)",
    ),

  // PROJ-27 (AC4): Dauerfristverlängerung — verschiebt die USt-VA-Abgabefrist
  // um einen Monat. Default false (Standardfall).
  dauerfristverlaengerung: z.boolean().optional().default(false),
});

/** Validierte/normalisierte Profildaten (Output nach Transform). */
export type FirmenprofilInput = z.infer<typeof firmenprofilSchema>;

/** Form-Eingabewerte vor Transform (alle Felder als String aus den Inputs). */
export type FirmenprofilFormValues = {
  firmenname: string;
  inhaber: string;
  steuernummer: string;
  ust_idnr: string;
  strasse: string;
  plz: string;
  ort: string;
  finanzamt: string;
  rechtsform: "einzelunternehmer" | "freiberufler";
  ust_status: "regelbesteuerung" | "kleinunternehmer";
  wirtschaftsjahr_beginn: number;
  ust_va_rhythmus: "monatlich" | "quartalsweise" | "jaehrlich";
  rhythmus_gueltig_ab: string;
  dauerfristverlaengerung: boolean;
};

/** Leere Default-Werte für das Formular (kein vorhandenes Profil). */
export const FIRMENPROFIL_DEFAULTS: FirmenprofilFormValues = {
  firmenname: "",
  inhaber: "",
  steuernummer: "",
  ust_idnr: "",
  strasse: "",
  plz: "",
  ort: "",
  finanzamt: "",
  rechtsform: "einzelunternehmer",
  ust_status: "regelbesteuerung",
  wirtschaftsjahr_beginn: 1,
  ust_va_rhythmus: "monatlich",
  rhythmus_gueltig_ab: "",
  dauerfristverlaengerung: false,
};
