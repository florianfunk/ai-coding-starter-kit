export type EntityType = "bereich" | "kategorie" | "produkt";
export type Laenge = "kurz" | "mittel" | "lang";

const ENTITY_LABEL: Record<EntityType, string> = {
  bereich: "Bereich",
  kategorie: "Kategorie",
  produkt: "Produkt",
};

const LAENGE_HINT: Record<Laenge, string> = {
  kurz: "Schreibe genau einen prägnanten Satz (max. 25 Wörter).",
  mittel: "Schreibe 2 bis 3 Sätze (40 bis 70 Wörter).",
  lang: "Schreibe einen kompakten Absatz mit 4 bis 6 Sätzen (80 bis 130 Wörter).",
};

export interface BuildPromptInput {
  entityType: EntityType;
  entityName: string;
  entityContext?: string | null;
  zusatzHinweis?: string | null;
  laenge: Laenge;
}

export function buildSystemPrompt(): string {
  return [
    "Du bist Marketing-Texter für LICHT.ENGROS / Eisenkeil, einen deutschen B2B-Großhandel für professionelle Beleuchtung (LED-Strips, Profile, Leuchten, Treiber).",
    "Zielgruppe: Architekten, Lichtplaner, Elektroinstallateure, Innenausbauer.",
    "Stil: sachlich-modern, präzise, kein Marketing-Geschwurbel, keine Superlative ohne Beleg, keine Anrede ('Sie'), keine Fragen, keine Aufzählung. Aktive Sprache. Deutscher B2B-Ton.",
    "Vermeide: 'innovativ', 'revolutionär', 'einzigartig', 'perfekt', '!'-Sätze.",
    "Antworte ausschließlich mit dem reinen Teaser-Text — keine Anführungszeichen, keine Einleitung, kein Markdown, keine Überschriften.",
  ].join(" ");
}

export function buildUserPrompt(input: BuildPromptInput): string {
  const label = ENTITY_LABEL[input.entityType];
  const parts: string[] = [
    `Schreibe einen Teaser-Text für ${input.entityType === "produkt" ? "das Produkt" : `den/die ${label}`}: "${input.entityName}".`,
  ];
  if (input.entityContext?.trim()) {
    parts.push(`Vorhandene Beschreibung/Kontext: ${input.entityContext.trim()}`);
  }
  if (input.zusatzHinweis?.trim()) {
    parts.push(`Zusatz-Hinweis: ${input.zusatzHinweis.trim()}`);
  }
  parts.push(LAENGE_HINT[input.laenge]);
  return parts.join("\n\n");
}
