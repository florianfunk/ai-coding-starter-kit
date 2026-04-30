/**
 * PROJ-38: Erzeugt das Vorschau-PNG fuer eine Datenblatt-Vorlage.
 *
 * Rendert das LaTeX-Datenblatt fuer ein Beispiel-Produkt (1. mit aktivem Hauptbild),
 * konvertiert die erste PDF-Seite zu PNG und legt sie unter
 *   public/datenblatt-vorlagen/preview-<latex_template_key>.png
 *
 * Erfordert: pdftoppm (poppler) im PATH.
 *
 * Usage:
 *   npx tsx scripts/generate-vorlage-preview.ts <latex_template_key>
 *
 * Beispiel:
 *   npx tsx scripts/generate-vorlage-preview.ts lichtengross-datenblatt-modern
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  buildModernDatenblattPayload,
  renderModernDatenblattPdf,
} from "../src/lib/latex/datenblatt-modern-payload";

async function main() {
  config({ path: ".env.local" });
  const key = process.argv[2];
  if (!key) {
    console.error("Usage: tsx scripts/generate-vorlage-preview.ts <latex_template_key>");
    process.exit(1);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: tpl } = await admin
    .from("datenblatt_templates")
    .select("id, name, latex_template_key, slots")
    .eq("latex_template_key", key)
    .single();
  if (!tpl) {
    console.error(`Vorlage mit latex_template_key="${key}" nicht gefunden.`);
    process.exit(1);
  }

  // Beispiel-Produkt: erstes mit Hauptbild
  const { data: produkt } = await admin
    .from("produkte")
    .select("id, artikelnummer")
    .not("hauptbild_path", "is", null)
    .limit(1)
    .single();
  if (!produkt) {
    console.error("Kein Produkt mit Hauptbild gefunden.");
    process.exit(1);
  }
  console.log(`Beispiel-Produkt: ${produkt.artikelnummer} (${produkt.id})`);

  const payload = await buildModernDatenblattPayload(admin as any, produkt.id, "lichtengros", {
    id: tpl.id,
    slots: tpl.slots as { id: string; kind: "image" | "energielabel" | "cutting"; position?: string }[],
  });
  const pdfBuf = await renderModernDatenblattPdf(payload);

  const outDir = path.resolve("public/datenblatt-vorlagen");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const tmpPdf = path.join("tmp", `preview-${key}.pdf`);
  if (!existsSync("tmp")) mkdirSync("tmp", { recursive: true });
  writeFileSync(tmpPdf, pdfBuf);
  console.log(`PDF geschrieben: ${tmpPdf} (${(pdfBuf.length / 1024).toFixed(0)} KB)`);

  // Konvertiere Seite 1 zu PNG (300 dpi → ca. 2480x3508 px, fuer Web genug)
  const tmpPngBase = path.join("tmp", `preview-${key}`);
  execSync(`pdftoppm -png -r 150 -f 1 -l 1 "${tmpPdf}" "${tmpPngBase}"`, { stdio: "inherit" });
  // pdftoppm haengt "-1" an wenn -f 1 -l 1
  const generatedPng = `${tmpPngBase}-1.png`;
  if (!existsSync(generatedPng)) {
    console.error(`Konvertiertes PNG nicht gefunden: ${generatedPng}`);
    process.exit(1);
  }

  const outPng = path.join(outDir, `preview-${key}.png`);
  writeFileSync(outPng, readFileSync(generatedPng));
  unlinkSync(generatedPng);
  unlinkSync(tmpPdf);
  console.log(`Vorschau: ${outPng}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
