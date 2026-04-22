import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

async function main() {
  config({ path: ".env.local" });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: kategorien } = await supabase
    .from("kategorien")
    .select("name, bild1_path, bild2_path, bild3_path, bild4_path");

  const binPaths: { kat: string; slot: string; path: string }[] = [];
  for (const k of kategorien!) {
    for (let i = 1; i <= 4; i++) {
      const p = (k as any)[`bild${i}_path`] as string | null;
      if (p?.endsWith(".bin")) binPaths.push({ kat: k.name, slot: `bild${i}`, path: p });
    }
  }
  console.log(`Found ${binPaths.length} .bin files\n`);

  for (const { kat, slot, path } of binPaths) {
    const { data, error } = await supabase.storage.from("produktbilder").download(path);
    if (error) { console.log(`  ${kat}/${slot}: download failed: ${error.message}`); continue; }
    const buf = Buffer.from(await data.arrayBuffer());
    const head = buf.slice(0, 16).toString("hex");
    let kind = "unknown";
    if (head.startsWith("25504446")) kind = "PDF";
    else if (head.startsWith("ffd8ff")) kind = "JPEG";
    else if (head.startsWith("89504e47")) kind = "PNG";
    else if (head.startsWith("47494638")) kind = "GIF";
    else if (head.startsWith("52494646")) kind = "RIFF/WEBP";
    else if (head.startsWith("424d")) kind = "BMP";
    else if (head.startsWith("01000000") && head.slice(8).startsWith("6c0000")) kind = "EMF (Windows Metafile)";
    else if (head.startsWith("d7cdc69a")) kind = "WMF (old)";
    else if (head.startsWith("49492a00") || head.startsWith("4d4d002a")) kind = "TIFF";
    console.log(`  ${(kat + " / " + slot).padEnd(45)} ${kind.padEnd(25)} head=${head.slice(0, 16)}`);
  }
}
main();
