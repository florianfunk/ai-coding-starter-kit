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
 * Belegklassifizierung. Default = Opus 4.8 (höchste Genauigkeit, Vorgabe
 * "bestes Ergebnis, Kosten egal"); Haiku/Sonnet als günstigere Alternativen.
 */
export const CLAUDE_MODELLE: readonly ClaudeModell[] = [
  {
    slug: "anthropic/claude-opus-4-8",
    label: "Claude Opus 4.8",
    hinweis: "Höchste Genauigkeit — empfohlener Standard (bestes Ergebnis)",
  },
  {
    slug: "anthropic/claude-opus-4-7",
    label: "Claude Opus 4.7",
    hinweis: "Höchste Genauigkeit, vorherige Opus-Generation",
  },
  {
    slug: "anthropic/claude-opus-4-6",
    label: "Claude Opus 4.6",
    hinweis: "Höchste Genauigkeit, ältere Opus-Generation",
  },
  {
    slug: "anthropic/claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    hinweis: "Ausgewogen, schneller & günstiger als Opus",
  },
  {
    slug: "anthropic/claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    hinweis: "Am schnellsten & günstigsten — für einfache Buchungstexte",
  },
] as const;

export const STANDARD_MODELL = "anthropic/claude-opus-4-8";

/** Sentinel-Wert im Dropdown für freie Slug-Eingabe. */
export const FREITEXT_OPTION = "__freitext__";
