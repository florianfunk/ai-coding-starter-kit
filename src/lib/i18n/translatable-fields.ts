/**
 * PROJ-46 — Italienische Übersetzung für Datenblätter.
 *
 * Zentrale Liste der Produkt-Textfelder, die für Datenblätter ins Italienische
 * übersetzt werden. UI, API-Routen und Server-Actions lesen alle aus dieser
 * einen Quelle, damit DE und IT garantiert dieselben Felder kennen.
 */

export type TranslatableInputType = "input" | "textarea" | "richtext";

export type TranslatableField = {
  /** Spaltenname der deutschen Quelle in `produkte`. */
  de: string;
  /** Spaltenname der italienischen Spiegelspalte in `produkte`. */
  it: string;
  /** Anzeigelabel im Formular. */
  label: string;
  /** UI-Widget für den IT-Editor. */
  type: TranslatableInputType;
  /** Maximale Zeichenlänge (Plaintext bei richtext) — schützt API-Payload. */
  maxLen: number;
  /** Optionaler Hinweis unter dem Feld. */
  hint?: string;
};

export const TRANSLATABLE_FIELDS: readonly TranslatableField[] = [
  {
    de: "name",
    it: "name_it",
    label: "Bezeichnung",
    type: "input",
    maxLen: 200,
  },
  {
    de: "datenblatt_titel",
    it: "datenblatt_titel_it",
    label: "Datenblatt-Titel",
    type: "input",
    maxLen: 200,
  },
  {
    de: "info_kurz",
    it: "info_kurz_it",
    label: "Info-Zeile",
    type: "input",
    maxLen: 500,
    hint: "Kurzbeschreibung unter der Artikelnummer",
  },
  {
    de: "treiber",
    it: "treiber_it",
    label: "Treiber",
    type: "textarea",
    maxLen: 1000,
  },
  {
    de: "datenblatt_text",
    it: "datenblatt_text_it",
    label: "Beschreibungstext",
    type: "richtext",
    maxLen: 12000,
    hint: "Haupt-Fließtext im Datenblatt",
  },
  {
    de: "achtung_text",
    it: "achtung_text_it",
    label: "Sicherheitshinweis",
    type: "richtext",
    maxLen: 2000,
    hint: "Erscheint im Datenblatt als Warnbox „ATTENZIONE“",
  },
  {
    de: "bild_detail_1_text",
    it: "bild_detail_1_text_it",
    label: "Detail-Text 1",
    type: "textarea",
    maxLen: 500,
  },
  {
    de: "bild_detail_2_text",
    it: "bild_detail_2_text_it",
    label: "Detail-Text 2",
    type: "textarea",
    maxLen: 500,
  },
  {
    de: "bild_detail_3_text",
    it: "bild_detail_3_text_it",
    label: "Detail-Text 3",
    type: "textarea",
    maxLen: 500,
    hint: "Erscheint neben Zeichnung 1 im PDF",
  },
] as const;

export const TRANSLATABLE_DE_KEYS = TRANSLATABLE_FIELDS.map((f) => f.de);
export const TRANSLATABLE_IT_KEYS = TRANSLATABLE_FIELDS.map((f) => f.it);

export type TranslatableDeKey = (typeof TRANSLATABLE_FIELDS)[number]["de"];
export type TranslatableItKey = (typeof TRANSLATABLE_FIELDS)[number]["it"];

/** Map DE-Schlüssel → Field-Definition (für schnelle Lookups). */
export const TRANSLATABLE_BY_DE: Record<string, TranslatableField> = Object.fromEntries(
  TRANSLATABLE_FIELDS.map((f) => [f.de, f]),
);
