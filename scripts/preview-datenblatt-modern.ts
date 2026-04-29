/**
 * Rendert das *moderne* LaTeX-Datenblatt (Claude-Design-Variante) lokal.
 *
 *   npx tsx scripts/preview-datenblatt-modern.ts <artNr|uuid>
 *   npx tsx scripts/preview-datenblatt-modern.ts <artNr> --layout=eisenkeil
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import {
  buildModernDatenblattPayload,
  renderModernDatenblattPdf,
  type ModernBrand,
} from "../src/lib/latex/datenblatt-modern-payload";

async function main() {
  config({ path: ".env.local" });
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: tsx scripts/preview-datenblatt-modern.ts <artNr|uuid> [--layout=eisenkeil]");
    process.exit(1);
  }
  const layoutFlag = process.argv.find((a) => a.startsWith("--layout="));
  const layout: ModernBrand = layoutFlag?.endsWith("eisenkeil") ? "eisenkeil" : "lichtengros";

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

  const payload = await buildModernDatenblattPayload(admin as any, produkt.id, layout);
  console.log(
    `  quickfacts=${payload.quickfacts.length} ` +
    `spec_groups=${payload.spec_groups.length} (${payload.spec_groups.reduce((n, g) => n + g.rows.length, 0)} rows) ` +
    `paragraphs=${payload.paragraphs.length} ` +
    `images=${Object.keys(payload.images_b64).length}`,
  );

  const pdfBuf = await renderModernDatenblattPdf(payload);

  const outDir = "tmp";
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `datenblatt-modern-${layout}-${produkt.artikelnummer}.pdf`);
  writeFileSync(outPath, pdfBuf);
  console.log(`Geschrieben: ${outPath} (${(pdfBuf.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
