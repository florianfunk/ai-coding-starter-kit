/**
 * Rendert das LaTeX-Datenblatt für ein Produkt und schreibt das PDF nach
 * tmp/. Nutzt denselben Payload-Builder wie der Live-Endpunkt
 * /produkte/[id]/datenblatt/raw.
 *
 * Usage:
 *   npx tsx scripts/preview-datenblatt-latex.ts <artikelnummer|uuid>
 *   npx tsx scripts/preview-datenblatt-latex.ts <artNr> --layout=eisenkeil
 *
 * Erwartet in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   LATEX_WORKER_URL, LATEX_WORKER_TOKEN
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import {
  buildDatenblattPayload,
  renderDatenblattPdf,
  type Brand,
} from "../src/lib/latex/datenblatt-payload";

async function main() {
  config({ path: ".env.local" });
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: tsx scripts/preview-datenblatt-latex.ts <artikelnummer|uuid> [--layout=eisenkeil]");
    process.exit(1);
  }

  const layoutFlag = process.argv.find((a) => a.startsWith("--layout="));
  const layout: Brand = layoutFlag?.endsWith("eisenkeil") ? "eisenkeil" : "lichtengros";

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const isUuid = /^[0-9a-f-]{36}$/i.test(arg);
  const { data: produkt, error } = isUuid
    ? await admin.from("produkte").select("id, artikelnummer").eq("id", arg).single()
    : await admin.from("produkte").select("id, artikelnummer").eq("artikelnummer", arg).single();
  if (error || !produkt) {
    console.error("Produkt nicht gefunden:", arg, error?.message);
    process.exit(1);
  }
  console.log(`Produkt: ${produkt.artikelnummer} (${produkt.id}), Layout: ${layout}`);

  const payload = await buildDatenblattPayload(admin as any, produkt.id, layout);
  const totalBytes = Object.values(payload.images_b64).reduce(
    (n, b64) => n + Math.ceil(b64.length * 0.75),
    0,
  );
  console.log(
    `  images=${Object.keys(payload.images_b64).length}, ~${(totalBytes / 1024).toFixed(0)} KB ` +
    `tech_rows=${payload.tech_rows.length} icons=${payload.icons.filter((i) => i.filename).length}`,
  );

  const pdfBuf = await renderDatenblattPdf(payload);

  const outDir = "tmp";
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `datenblatt-${layout}-${produkt.artikelnummer}.pdf`);
  writeFileSync(outPath, pdfBuf);
  console.log(`Geschrieben: ${outPath} (${(pdfBuf.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
