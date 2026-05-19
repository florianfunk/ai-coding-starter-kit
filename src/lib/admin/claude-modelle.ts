// PROJ-13 — Kuratierte Claude-Modelle für das KI-Modell-Dropdown.
// AI-Gateway-Slug-Format: "anthropic/<modell>".
// Die Live-Liste vom Gateway (/api/admin/ki/modelle) hat Vorrang, sobald ein
// Key gesetzt ist; diese Liste ist der Fallback ohne Key und der sinnvolle
// Default-Vorschlag.

export interface ClaudeModell {
  /** AI-Gateway-Slug, exakt wie an `generateObject({ model })` übergeben. */
  slug: string;
  /** Anzeigename im Dropdown. */
  label: string;
  /** Kurzer Eignungs-Hinweis. */
  hinweis?: string;
}

/**
 * Aktuelle Claude-Modellfamilie (4.x). Reihenfolge = Empfehlung für die
 * Belegklassifizierung: Haiku als günstiger, schneller Default; Sonnet/Opus
 * für höhere Genauigkeit bei schwierigen Buchungstexten.
 */
export const CLAUDE_MODELLE: readonly ClaudeModell[] = [
  {
    slug: "anthropic/claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    hinweis: "Schnell & günstig — empfohlener Standard für die Klassifizierung",
  },
  {
    slug: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    hinweis: "Ausgewogen — höhere Genauigkeit bei schwierigen Buchungstexten",
  },
  {
    slug: "anthropic/claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    hinweis: "Ausgewogen, neuere Sonnet-Generation",
  },
  {
    slug: "anthropic/claude-opus-4-6",
    label: "Claude Opus 4.6",
    hinweis: "Höchste Genauigkeit — langsamer und teurer",
  },
  {
    slug: "anthropic/claude-opus-4-7",
    label: "Claude Opus 4.7",
    hinweis: "Höchste Genauigkeit, neueste Opus-Generation",
  },
] as const;

export const STANDARD_MODELL = "anthropic/claude-haiku-4-5";

/** Sentinel-Wert im Dropdown für freie Slug-Eingabe. */
export const FREITEXT_OPTION = "__freitext__";
