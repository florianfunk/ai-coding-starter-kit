/**
 * Harmonische Pastell-Farbpalette für Bereich-Farbpunkte im Katalog-Index.
 *
 * 40 Farbtöne, aufeinander abgestimmt — leicht gesättigte Pastelltöne,
 * die neben dem dunklen Katalog-Design bestehen können und im Index-Farbpunkt
 * als klarer Bereichs-Marker funktionieren.
 *
 * Inspiriert vom Original-Katalog (LED STRIP = #FFE4E1, NEON FLEX = #FFFACD, etc.)
 */
export type Farbe = { name: string; hex: string };

export const FARBPALETTE: Farbe[] = [
  // Rot/Rosa-Töne (warm)
  { name: "Rosa Hell",         hex: "#FFE4E1" },
  { name: "Rosa",              hex: "#FFD1DC" },
  { name: "Altrosa",           hex: "#E8B4B8" },
  { name: "Rouge",             hex: "#D4847C" },

  // Orange/Pfirsich
  { name: "Pfirsich Hell",     hex: "#FFE5B4" },
  { name: "Pfirsich",          hex: "#FFCBA4" },
  { name: "Apricot",           hex: "#FBCEB1" },
  { name: "Terrakotta",        hex: "#E2725B" },

  // Gelb
  { name: "Vanille",           hex: "#FFFACD" },
  { name: "Pastellgelb",       hex: "#FDFD96" },
  { name: "Butter",            hex: "#FFF8B8" },
  { name: "Champagner",        hex: "#F7E7CE" },

  // Oliv/Beige
  { name: "Creme",             hex: "#FFF5E1" },
  { name: "Beige",             hex: "#F5F5DC" },
  { name: "Sand",              hex: "#E4D8B4" },
  { name: "Khaki Hell",        hex: "#D8D8A8" },

  // Grün-Töne
  { name: "Mint",              hex: "#BDFCC9" },
  { name: "Pastellgrün",       hex: "#C5E1A5" },
  { name: "Salbei",            hex: "#B2C9AB" },
  { name: "Eukalyptus",        hex: "#A8D5BA" },
  { name: "Hellgrün",          hex: "#D0F0C0" },
  { name: "Waldmeister",       hex: "#8FBC8F" },

  // Türkis/Petrol
  { name: "Aqua",              hex: "#B8E6E6" },
  { name: "Türkis Hell",       hex: "#AFEEEE" },
  { name: "Petrol Hell",       hex: "#9BB7C4" },
  { name: "Eisblau",           hex: "#C4E4E9" },

  // Blau
  { name: "Hellblau",          hex: "#BFDFFF" },
  { name: "Himmelblau",        hex: "#A7C7E7" },
  { name: "Puderblau",         hex: "#B0C4DE" },
  { name: "Pastellblau",       hex: "#AEC6CF" },
  { name: "Denim Hell",        hex: "#9FB4C7" },

  // Violett/Flieder
  { name: "Flieder",           hex: "#DCC6E0" },
  { name: "Lavendel",          hex: "#E6D3F4" },
  { name: "Lilac",             hex: "#C8A2C8" },
  { name: "Mauve",             hex: "#B784A7" },

  // Neutrale Grautöne
  { name: "Perlgrau",          hex: "#E5E4E2" },
  { name: "Silber",            hex: "#D3D3D3" },
  { name: "Nebel",             hex: "#C9C9C9" },
  { name: "Taupe",             hex: "#B8ADA0" },
  { name: "Anthrazit Hell",    hex: "#A8A8A8" },
];

export function findFarbeByHex(hex: string | null | undefined): Farbe | null {
  if (!hex) return null;
  const normalized = hex.toUpperCase();
  return FARBPALETTE.find((f) => f.hex.toUpperCase() === normalized) ?? null;
}
