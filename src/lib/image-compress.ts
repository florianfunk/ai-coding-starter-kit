import sharp from "sharp";

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Compressed = {
  buffer: Buffer;
  contentType: string;
  extension: string;
};

/**
 * Re-encodiert JPEG/PNG/WebP auf max. 1920×1920 (contain) und moderate Qualität.
 * Unkomprimierbare Formate (SVG, PDF, animierte GIFs …) werden unverändert
 * zurückgegeben — Aufrufer soll anhand von `COMPRESSIBLE_TYPES` entscheiden.
 *
 * Hintergrund: Ein 5 MB-JPEG bringt den Next.js Image Optimizer bei Cold Start
 * zum Timeouten. Nach Kompression liegen Thumbnails typischerweise <400 kB.
 */
export async function compressImage(file: File): Promise<Compressed> {
  if (!COMPRESSIBLE_TYPES.has(file.type)) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    return { buffer, contentType: file.type, extension };
  }

  const input = Buffer.from(await file.arrayBuffer());
  const pipeline = sharp(input, { failOn: "none" })
    .rotate() // EXIF-Rotation anwenden, bevor wir Exif beim Encode verlieren
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true });

  // PNG bleibt PNG (Transparenz), JPEG/WebP → JPEG (kleiner + kompatibel)
  if (file.type === "image/png") {
    const buffer = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();
    return { buffer, contentType: "image/png", extension: "png" };
  }

  const buffer = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return { buffer, contentType: "image/jpeg", extension: "jpg" };
}

export function isCompressible(type: string): boolean {
  return COMPRESSIBLE_TYPES.has(type);
}
