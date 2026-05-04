/**
 * Vollständigkeits-Berechnung für Produkte.
 *
 * Deterministisch: gleicher Input ergibt immer das gleiche Ergebnis.
 */

export type CompletenessResult = {
  percent: number;
  missing: string[];
  color: "red" | "yellow" | "green";
};

type ProduktLike = {
  artikelnummer?: string | null;
  name?: string | null;
  kategorie_id?: string | null;
  hauptbild_path?: string | null;
  datenblatt_titel?: string | null;
  datenblatt_text?: string | null;
  leistung_w?: number | null;
  lichtstrom_lm?: number | null;
  farbtemperatur_k?: number | null;
  schutzart_ip?: string | null;
  masse_text?: string | null;
  laenge_mm?: number | null;
  breite_mm?: number | null;
  hoehe_mm?: number | null;
  /**
   * Sections, die der Pfleger manuell als „alle Daten eingegeben" markiert hat.
   * Eine Markierung wirkt als „Bucket erfüllt" für die zugeordneten Pauschal-Felder
   * (siehe Mapping in 0025_produkt_vollstaendig_sections.sql).
   */
  vollstaendig_sections?: string[] | null;
};

function hasSection(p: ProduktLike, id: string): boolean {
  return Array.isArray(p.vollstaendig_sections) && p.vollstaendig_sections.includes(id);
}

/* ------------------------------------------------------------------ */
/*  Field definitions                                                  */
/* ------------------------------------------------------------------ */

type FieldCheck = {
  label: string;
  weight: number;
  check: (p: ProduktLike, ctx: CompletenessContext) => boolean;
};

type CompletenessContext = {
  hasActivePrice: boolean;
  iconCount: number;
};

const FIELDS: FieldCheck[] = [
  // Pflichtfelder (je 10 %)
  { label: "Artikelnummer", weight: 10, check: (p) => Boolean(p.artikelnummer?.trim()) },
  { label: "Name", weight: 10, check: (p) => Boolean(p.name?.trim()) },
  { label: "Kategorie", weight: 10, check: (p) => p.kategorie_id != null },
  { label: "Hauptbild", weight: 10, check: (p) => p.hauptbild_path != null },
  { label: "Aktiver Preis", weight: 10, check: (_p, ctx) => ctx.hasActivePrice },

  // Optionale Felder (zusammen 50 %) — jedes Feld kann durch eine Section-
  // Markierung als „erfüllt" gelten. Mapping siehe Migration 0025.
  {
    label: "Datenblatttitel",
    weight: 7,
    check: (p) => Boolean(p.datenblatt_titel?.trim()) || hasSection(p, "datenblatt"),
  },
  {
    label: "Datenblatttext",
    weight: 7,
    check: (p) => Boolean(p.datenblatt_text?.trim()) || hasSection(p, "datenblatt"),
  },
  {
    label: "Technische Daten",
    weight: 8,
    check: (p) =>
      p.leistung_w != null ||
      p.lichtstrom_lm != null ||
      p.farbtemperatur_k != null ||
      (p.schutzart_ip != null && p.schutzart_ip.trim() !== "") ||
      hasSection(p, "elektrisch") ||
      hasSection(p, "lichttechnisch") ||
      hasSection(p, "thermisch"),
  },
  {
    label: "Abmessungen",
    weight: 6,
    check: (p) =>
      Boolean(p.masse_text?.trim()) ||
      p.laenge_mm != null ||
      p.breite_mm != null ||
      p.hoehe_mm != null ||
      hasSection(p, "mechanisch"),
  },
  {
    label: "Icon zugeordnet",
    weight: 3,
    check: (p, ctx) => ctx.iconCount > 0 || hasSection(p, "icons"),
  },
];

// Sanity: weights must add up to 100
const TOTAL_WEIGHT = FIELDS.reduce((s, f) => s + f.weight, 0);

/* ------------------------------------------------------------------ */
/*  Main function                                                      */
/* ------------------------------------------------------------------ */

export function calculateCompleteness(
  produkt: ProduktLike,
  ctx: CompletenessContext,
): CompletenessResult {
  let earned = 0;
  const missing: string[] = [];

  for (const field of FIELDS) {
    if (field.check(produkt, ctx)) {
      earned += field.weight;
    } else {
      missing.push(field.label);
    }
  }

  const percent = Math.round((earned / TOTAL_WEIGHT) * 100);
  const color: CompletenessResult["color"] =
    percent < 50 ? "red" : percent <= 80 ? "yellow" : "green";

  return { percent, missing, color };
}

/* ------------------------------------------------------------------ */
/*  Color helpers for Tailwind class names                             */
/* ------------------------------------------------------------------ */

export function completenessBarClass(color: CompletenessResult["color"]): string {
  switch (color) {
    case "red":
      return "bg-destructive";
    case "yellow":
      return "bg-amber-500";
    case "green":
      return "bg-success";
  }
}

export function completenessTextClass(color: CompletenessResult["color"]): string {
  switch (color) {
    case "red":
      return "text-destructive";
    case "yellow":
      return "text-amber-600";
    case "green":
      return "text-success";
  }
}
