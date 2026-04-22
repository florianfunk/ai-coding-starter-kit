import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

async function main() {
  config({ path: ".env.local" });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const mode = process.argv[2];

  if (mode === "clean") {
    const { data: files } = await supabase.storage.from("produktbilder").list("icons", { limit: 500 });
    if (!files?.length) return console.log("nothing to delete");
    const paths = files.map((f) => `icons/${f.name}`);
    const { error } = await supabase.storage.from("produktbilder").remove(paths);
    if (error) throw error;
    console.log(`deleted ${paths.length} files`);
    return;
  }

  if (mode === "kategorien") {
    const { data, error } = await supabase
      .from("kategorien")
      .select("name, bild1_path, bild2_path, bild3_path, bild4_path")
      .order("name");
    if (error) throw error;
    const extCount: Record<string, number> = {};
    for (const k of data!) {
      for (const p of [k.bild1_path, k.bild2_path, k.bild3_path, k.bild4_path]) {
        if (!p) continue;
        const ext = p.split(".").pop() ?? "?";
        extCount[ext] = (extCount[ext] ?? 0) + 1;
      }
    }
    console.log("File extensions across bild1..bild4:");
    for (const [ext, n] of Object.entries(extCount)) console.log(`  ${ext}: ${n}`);

    const tina = data!.find((k) => k.name === "Tina");
    if (tina) {
      console.log("\nTina:");
      console.log("  bild1:", tina.bild1_path);
      console.log("  bild2:", tina.bild2_path);
      console.log("  bild3:", tina.bild3_path);
      console.log("  bild4:", tina.bild4_path);
    }
    return;
  }

  const { data: icons } = await supabase
    .from("icons")
    .select("label, gruppe, icon_kategorie, symbol_path")
    .order("label");
  console.log("Icons in DB:");
  for (const ic of icons!) {
    console.log(
      `  ${ic.label.padEnd(20)} gruppe=${(ic.gruppe ?? "-").padEnd(15)} icon_kategorie=${ic.icon_kategorie ?? "-"}`,
    );
  }
}
main();
