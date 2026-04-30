/**
 * Bildmaße auslesen via Sharp.
 *
 * Liefert Pixel-Dimensionen + cm-Umrechnung. Da JPEGs/PNGs ohne explizite
 * DPI-Angabe (oder mit fragwürdiger DPI-Information) unterwegs sind, gehen
 * wir von 300 dpi (Druck-Standard) als Default aus, sofern das Bild keine
 * verlässliche EXIF-DPI enthält.
 */

import sharp from "sharp";

const DEFAULT_DPI = 300;
const INCH_TO_CM = 2.54;

export interface ImageDimensions {
  widthPx: number;
  heightPx: number;
  /** Genutzte DPI für die cm-Berechnung (entweder aus EXIF oder Default 300). */
  dpi: number;
  widthCm: number;
  heightCm: number;
  format: string | null;
}

export async function readDimensions(buffer: Buffer): Promise<ImageDimensions | null> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).rotate().metadata();
    const widthPx = meta.width ?? 0;
    const heightPx = meta.height ?? 0;
    if (widthPx === 0 || heightPx === 0) return null;

    // Sharp liefert .density (DPI) — wenn vorhanden und plausibel, nutzen wir die
    const rawDpi = meta.density ?? 0;
    const dpi = rawDpi > 30 && rawDpi < 1500 ? rawDpi : DEFAULT_DPI;

    return {
      widthPx,
      heightPx,
      dpi,
      widthCm: round1(pxToCm(widthPx, dpi)),
      heightCm: round1(pxToCm(heightPx, dpi)),
      format: meta.format ?? null,
    };
  } catch {
    return null;
  }
}

function pxToCm(px: number, dpi: number): number {
  return (px / dpi) * INCH_TO_CM;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatDimensions(d: ImageDimensions): string {
  return `${d.widthPx}×${d.heightPx} px · ${d.widthCm}×${d.heightCm} cm @ ${d.dpi} dpi`;
}
