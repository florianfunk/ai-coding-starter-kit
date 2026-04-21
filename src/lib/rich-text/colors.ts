export type RichTextColor = { name: string; hex: string };

export const RICH_TEXT_COLORS: RichTextColor[] = [
  { name: "Standard", hex: "#000000" },
  { name: "Rot", hex: "#C0392B" },
  { name: "Blau", hex: "#1F4E79" },
  { name: "Orange", hex: "#D97706" },
  { name: "Grün", hex: "#15803D" },
];

export const ALLOWED_COLOR_HEXES = new Set(
  RICH_TEXT_COLORS.map((c) => c.hex.toUpperCase()),
);

export function isAllowedColor(hex: string | null | undefined): boolean {
  if (!hex) return false;
  return ALLOWED_COLOR_HEXES.has(hex.toUpperCase());
}
