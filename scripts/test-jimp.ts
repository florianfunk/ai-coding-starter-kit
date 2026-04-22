import { Jimp } from "jimp";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

async function main() {
  config({ path: ".env.local" });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase.storage.from("produktbilder").list("kategorien", { limit: 500 });
  const bmp = data!.find(f => f.name.endsWith(".bmp"));
  if (!bmp) { console.log("no .bmp found"); return; }
  console.log("testing:", bmp.name);
  const { data: blob } = await supabase.storage.from("produktbilder").download(`kategorien/${bmp.name}`);
  const buf = Buffer.from(await blob!.arrayBuffer());
  try {
    const img = await Jimp.read(buf);
    console.log(`✓ read: ${img.bitmap.width}x${img.bitmap.height}`);
    const png = await img.getBuffer("image/png");
    console.log(`✓ png buffer size: ${png.length}`);
  } catch (e: any) {
    console.log("✗ jimp failed:", e.message);
  }
}
main();
