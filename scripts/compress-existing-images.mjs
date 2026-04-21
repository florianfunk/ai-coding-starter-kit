/**
 * Einmaliges Cleanup: komprimiert bereits hochgeladene Bilder im Bucket
 * `produktbilder` auf max. 1920px / Quality 82 (JPEG) bzw. Palette-PNG.
 * Storage-Pfad bleibt gleich → alle DB-Referenzen bleiben gültig.
 *
 * Safety:
 *  - Skippt Bilder <400 kB (wahrscheinlich schon ok)
 *  - Skippt Nicht-Raster-Dateien (SVG, PDF)
 *  - Skippt Pfade unter `icons/` (Logos bleiben pixelgenau)
 *  - Läuft mit upsert:true, idempotent
 *
 * Aufruf:  node scripts/compress-existing-images.mjs
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { config } from "dotenv";

config({ path: ".env.local" });

const BUCKET = "produktbilder";
const SKIP_PREFIX = "icons/";
const MIN_BYTES = 400 * 1024; // Bilder <400 kB überspringen
const MAX_DIM = 1920;
const JPEG_QUALITY = 82;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE env vars fehlen");

const sb = createClient(url, key);

async function listAll(prefix = "") {
  const out = [];
  let offset = 0;
  const PAGE = 100;
  // Rekursiv alle Unterordner sammeln
  while (true) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}${entry.name}` : entry.name;
      // Ordner haben id=null, Dateien id=uuid
      if (entry.id) {
        out.push({ path: full, size: entry.metadata?.size ?? 0, mime: entry.metadata?.mimetype });
      } else {
        const children = await listAll(`${full}/`);
        out.push(...children);
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

function targetFormat(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/webp") return "jpeg";
  return null;
}

async function main() {
  console.log(`→ Scanning bucket ${BUCKET} …`);
  const all = await listAll();
  console.log(`  found ${all.length} files total`);

  const candidates = all.filter(
    (f) => !f.path.startsWith(SKIP_PREFIX) && f.size >= MIN_BYTES && targetFormat(f.mime),
  );
  console.log(`  ${candidates.length} candidates (>${(MIN_BYTES / 1024).toFixed(0)}kB, raster, not icons)`);

  let done = 0;
  let savedBytes = 0;
  let skipped = 0;

  for (const f of candidates) {
    const { data, error } = await sb.storage.from(BUCKET).download(f.path);
    if (error || !data) {
      console.warn(`  ! skip ${f.path}: ${error?.message}`);
      skipped++;
      continue;
    }
    const inputBuf = Buffer.from(await data.arrayBuffer());
    const format = targetFormat(f.mime);
    const pipeline = sharp(inputBuf, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true });

    const outputBuf =
      format === "png"
        ? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
        : await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();

    if (outputBuf.length >= inputBuf.length * 0.95) {
      console.log(`  = ${f.path} already small (${(inputBuf.length / 1024).toFixed(0)}kB → ${(outputBuf.length / 1024).toFixed(0)}kB)`);
      skipped++;
      continue;
    }

    const contentType = format === "png" ? "image/png" : "image/jpeg";
    const { error: upErr } = await sb.storage.from(BUCKET).upload(f.path, outputBuf, {
      contentType,
      upsert: true,
    });
    if (upErr) {
      console.warn(`  ! upload failed ${f.path}: ${upErr.message}`);
      skipped++;
      continue;
    }
    const saved = inputBuf.length - outputBuf.length;
    savedBytes += saved;
    done++;
    console.log(
      `  ✓ ${f.path}: ${(inputBuf.length / 1024).toFixed(0)}kB → ${(outputBuf.length / 1024).toFixed(0)}kB (−${((saved / inputBuf.length) * 100).toFixed(0)}%)`,
    );
  }

  console.log(`\nDone. Compressed ${done} files, skipped ${skipped}. Total saved: ${(savedBytes / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
