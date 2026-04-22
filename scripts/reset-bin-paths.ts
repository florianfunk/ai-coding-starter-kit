/**
 * Setzt alle .bin-Pfade in kategorien.bildN_path auf NULL und löscht die .bin-Dateien im Bucket,
 * damit der Re-Import sie mit dem neuen Magic-Byte-Detection-Logic erneut hochlädt.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

async function main() {
  config({ path: ".env.local" });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: kategorien, error } = await supabase
    .from("kategorien")
    .select("id, name, bild1_path, bild2_path, bild3_path, bild4_path");
  if (error) throw error;

  const toDelete: string[] = [];
  let rowsUpdated = 0;

  for (const k of kategorien!) {
    const patch: Record<string, null> = {};
    for (let i = 1; i <= 4; i++) {
      const col = `bild${i}_path`;
      const p = (k as any)[col] as string | null;
      if (p?.endsWith(".bin") || p?.endsWith(".bmp")) {
        patch[col] = null;
        toDelete.push(p);
      }
    }
    if (Object.keys(patch).length) {
      const { error: updErr } = await supabase.from("kategorien").update(patch).eq("id", k.id);
      if (updErr) { console.warn(`  update failed for ${k.name}: ${updErr.message}`); continue; }
      rowsUpdated++;
      console.log(`  reset ${Object.keys(patch).join(", ")} on ${k.name}`);
    }
  }

  if (toDelete.length) {
    const { error: delErr } = await supabase.storage.from("produktbilder").remove(toDelete);
    if (delErr) console.warn("storage delete failed:", delErr.message);
    else console.log(`\n✓ ${rowsUpdated} Kategorien zurückgesetzt, ${toDelete.length} .bin-Dateien im Bucket gelöscht`);
  } else {
    console.log("Nichts zu tun.");
  }
}
main();
