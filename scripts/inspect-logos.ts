import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
async function main() {
  config({ path: ".env.local" });
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  // List assets bucket top-level
  const { data: list } = await admin.storage.from("assets").list("system", { limit: 100 });
  console.log("system/ files:");
  for (const f of list ?? []) console.log("  ", f.name);

  // Download all logos
  for (const f of list ?? []) {
    if (!/logo/i.test(f.name)) continue;
    const path = `system/${f.name}`;
    const { data } = await admin.storage.from("assets").createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      const res = await fetch(data.signedUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      const out = `/tmp/datenblatt-check/logo-${f.name}`;
      writeFileSync(out, buf);
      console.log("  ↓", out, buf.length, "bytes");
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
