// Zod-Schema für PROJ-7 Lernregeln.
//
// Das Schema erzeugt `bedingung`/`aktion`-Strukturen, die EXAKT kompatibel
// zur Regel-Engine in `src/lib/classifier/rules.ts` sind (gleiche Feldnamen,
// gleiche Typen). Wird im Client (Formular) und im Server (API) verwendet.
//
// Konfliktprüfung: eine reine Funktion erkennt widersprüchliche Regeln
// gleicher Priorität (gleiche Bedingung, abweichende Aktion). Sie spiegelt
// die Konflikt-Semantik der Pipeline (mehrere Regeln höchster Priorität mit
// uneinheitlicher Aktion → Prüfliste statt Auto-Verbuchung).

import { z } from "zod";
import type { Klassifikation, Lernregel } from "@/lib/types";

/** Erlaubte USt-Sätze (Spiegel des Kontenrahmen-Constraints {0,7,19}). */
export const UST_SAETZE = [0, 7, 19] as const;

/** Klassifikationswerte (Spiegel des DB-CHECK auf `buchung.klassifikation`). */
export const KLASSIFIKATIONEN = [
  "privat",
  "geschaeftlich",
  "unklar",
  "neutral",
] as const;

/** Optionaler getrimmter String → null, wenn leer. */
const optionalMuster = (maxLen: number, feld: string) =>
  z
    .string()
    .trim()
    .max(maxLen, `${feld} darf höchstens ${maxLen} Zeichen haben`)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

/**
 * Bedingung einer Lernregel — Feldnamen identisch zu
 * `Lernregel["bedingung"]` und der Auswertung in rules.ts.
 * Mindestens eine Teilbedingung muss gesetzt sein (kein Catch-All).
 */
export const bedingungSchema = z
  .object({
    empfaenger_muster: optionalMuster(200, "Empfänger-Muster"),
    zweck_muster: optionalMuster(200, "Verwendungszweck-Muster"),
    konto_id: z.uuid("Ungültige Konto-ID").optional(),
    betrag_min: z
      .number()
      .finite("Betrag (min) ungültig")
      .optional(),
    betrag_max: z
      .number()
      .finite("Betrag (max) ungültig")
      .optional(),
  })
  .refine(
    (b) =>
      Boolean(b.empfaenger_muster) ||
      Boolean(b.zweck_muster) ||
      Boolean(b.konto_id) ||
      typeof b.betrag_min === "number" ||
      typeof b.betrag_max === "number",
    {
      error:
        "Mindestens eine Bedingung angeben (Empfänger, Zweck, Konto oder Betragsbereich).",
      path: ["empfaenger_muster"],
    },
  )
  .refine(
    (b) =>
      typeof b.betrag_min !== "number" ||
      typeof b.betrag_max !== "number" ||
      b.betrag_min <= b.betrag_max,
    {
      error: "Betrag (min) darf nicht größer als Betrag (max) sein.",
      path: ["betrag_max"],
    },
  );

/**
 * Aktion einer Lernregel — Feldnamen identisch zu `Lernregel["aktion"]`.
 * Mindestens ein Aktionsfeld muss gesetzt sein (sonst bewirkt die Regel
 * nichts).
 */
export const aktionSchema = z
  .object({
    kategorie_id: z.uuid("Ungültige Kategorie-ID").optional(),
    ust_satz: z
      .union([z.literal(0), z.literal(7), z.literal(19)])
      .optional(),
    klassifikation: z.enum(KLASSIFIKATIONEN).optional(),
  })
  .refine(
    (a) =>
      Boolean(a.kategorie_id) ||
      typeof a.ust_satz === "number" ||
      Boolean(a.klassifikation),
    {
      error:
        "Mindestens eine Aktion angeben (Kategorie, USt-Satz oder privat/geschäftlich).",
      path: ["kategorie_id"],
    },
  );

/** Eingabeschema einer Lernregel (POST). */
export const regelInputSchema = z.object({
  bezeichnung: z
    .string()
    .trim()
    .min(2, "Bezeichnung muss mindestens 2 Zeichen haben")
    .max(120, "Bezeichnung darf höchstens 120 Zeichen haben"),
  bedingung: bedingungSchema,
  aktion: aktionSchema,
  prioritaet: z
    .number()
    .int("Priorität muss eine Ganzzahl sein")
    .min(0, "Priorität darf nicht negativ sein")
    .max(1000, "Priorität darf höchstens 1000 sein")
    .optional()
    .default(100),
  aktiv: z.boolean().optional().default(true),
});

/** Update-Schema (PUT) — identisch zum Eingabeschema. */
export const regelUpdateSchema = regelInputSchema;

export type RegelInput = z.input<typeof regelInputSchema>;
export type RegelParsed = z.output<typeof regelInputSchema>;
export type BedingungParsed = z.output<typeof bedingungSchema>;
export type AktionParsed = z.output<typeof aktionSchema>;

// ---------------------------------------------------------------------------
// Konfliktprüfung (reine Funktion, kein IO)
// ---------------------------------------------------------------------------

/** Minimal benötigte Felder einer Regel für die Konfliktprüfung. */
export type RegelFuerKonflikt = Pick<
  Lernregel,
  "id" | "bedingung" | "aktion" | "prioritaet" | "aktiv"
>;

/** Ein erkannter Konflikt zwischen zwei Regeln gleicher Priorität. */
export interface RegelKonflikt {
  regel_id: string;
  bezeichnung?: string;
  prioritaet: number;
  /** Welche Aktionsfelder sich widersprechen. */
  felder: Array<"kategorie_id" | "ust_satz" | "klassifikation">;
}

function normMuster(value: string | undefined): string {
  return (value ?? "").toLowerCase().trim();
}

/**
 * Zwei Bedingungen gelten als "gleich greifend", wenn alle
 * konfliktrelevanten Teilbedingungen übereinstimmen. Muster werden
 * case-insensitiv verglichen (wie in rules.ts). Eine Regel ohne
 * Bedingung kann hier nicht entstehen (Schema erzwingt mind. eine).
 */
export function bedingungenGleich(
  a: Lernregel["bedingung"] | undefined,
  b: Lernregel["bedingung"] | undefined,
): boolean {
  const x = a ?? {};
  const y = b ?? {};
  return (
    normMuster(x.empfaenger_muster) === normMuster(y.empfaenger_muster) &&
    normMuster(x.zweck_muster) === normMuster(y.zweck_muster) &&
    (x.konto_id ?? "") === (y.konto_id ?? "") &&
    (x.betrag_min ?? null) === (y.betrag_min ?? null) &&
    (x.betrag_max ?? null) === (y.betrag_max ?? null)
  );
}

/** Liefert die widersprüchlichen Aktionsfelder zweier Regeln. */
export function widerspruechlicheFelder(
  a: Lernregel["aktion"] | undefined,
  b: Lernregel["aktion"] | undefined,
): RegelKonflikt["felder"] {
  const aa = a ?? {};
  const ab = b ?? {};
  const felder: RegelKonflikt["felder"] = [];
  if (
    aa.kategorie_id != null &&
    ab.kategorie_id != null &&
    aa.kategorie_id !== ab.kategorie_id
  ) {
    felder.push("kategorie_id");
  }
  if (
    aa.ust_satz != null &&
    ab.ust_satz != null &&
    aa.ust_satz !== ab.ust_satz
  ) {
    felder.push("ust_satz");
  }
  if (
    aa.klassifikation != null &&
    ab.klassifikation != null &&
    (aa.klassifikation as Klassifikation) !==
      (ab.klassifikation as Klassifikation)
  ) {
    felder.push("klassifikation");
  }
  return felder;
}

/**
 * Prüft eine neue/geänderte Regel gegen die bestehenden (aktiven) Regeln.
 *
 * Konflikt = gleiche Priorität UND gleich greifende Bedingung UND
 * mindestens ein widersprüchliches Aktionsfeld. Genau diese Konstellation
 * verhindert in der Pipeline die deterministische Auto-Verbuchung.
 *
 * - `kandidat.id` wird (falls gesetzt) aus den bestehenden Regeln
 *   ausgeschlossen (Bearbeiten kollidiert nicht mit sich selbst).
 * - Inaktive Regeln (beidseitig) werden ignoriert.
 */
export function findeRegelKonflikte(
  kandidat: {
    id?: string;
    bedingung: Lernregel["bedingung"];
    aktion: Lernregel["aktion"];
    prioritaet: number;
    aktiv: boolean;
  },
  bestehende: readonly RegelFuerKonflikt[],
  bezeichnungen?: Readonly<Record<string, string>>,
): RegelKonflikt[] {
  if (!kandidat.aktiv) return [];
  const konflikte: RegelKonflikt[] = [];
  for (const r of bestehende) {
    if (kandidat.id && r.id === kandidat.id) continue;
    if (!r.aktiv) continue;
    if (r.prioritaet !== kandidat.prioritaet) continue;
    if (!bedingungenGleich(kandidat.bedingung, r.bedingung)) continue;
    const felder = widerspruechlicheFelder(kandidat.aktion, r.aktion);
    if (felder.length > 0) {
      konflikte.push({
        regel_id: r.id,
        bezeichnung: bezeichnungen?.[r.id],
        prioritaet: r.prioritaet,
        felder,
      });
    }
  }
  return konflikte;
}
