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
