/**
 * Löscht alle Demo-/Seed-Daten in den Produktkatalog-Tabellen,
 * damit danach der FileMaker-Import auf leerer Basis starten kann.
 *
 * Audit- und Setup-Tabellen (katalog_einstellungen Singleton, datenblatt_templates,
 * produkt_datenblatt_slots, filialen) werden NICHT geleert.
 *
 * Usage:  npx tsx scripts/reset-for-migration.ts [--yes]
 */
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

if (process.env.NODE_ENV === "production") {
  console.error("ABORTED: reset-for-migration darf nicht in production laufen.");
  process.exit(1);
}

const CONFIRMED = process.argv.includes("--yes");

const TABLES_IN_ORDER = [
  "produkt_datenblatt_slots",
  "produkt_icons",
  "produkt_bilder",
  "preise",
  "produkte",
  "kategorie_icons",
  "kategorien",
  "bereiche",
  "icons",
  "farbfelder",
  "katalog_seiten",
];

const STORAGE_BUCKETS = ["produktbilder", "assets"];

async function main() {
  const url = process.env.POSTGRES_URL_NON_POOLING!.replace(/[?&]sslmode=[^&]+/g, "");
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();

  const counts: Record<string, number> = {};
  for (const t of TABLES_IN_ORDER) {
    const res = await pg.query(`select count(*)::int as n from public.${t}`);
    counts[t] = res.rows[0].n;
  }
  console.log("Aktueller Stand:");
  for (const [t, n] of Object.entries(counts)) console.log(`  ${t.padEnd(28)} ${n}`);

  if (!CONFIRMED) {
    console.log("\nDry-run only. Mit --yes wirklich löschen.");
    await pg.end();
    return;
  }

  console.log("\nLösche…");
  for (const t of TABLES_IN_ORDER) {
    const res = await pg.query(`delete from public.${t}`);
    console.log(`  ${t.padEnd(28)} ${res.rowCount} rows deleted`);
  }
  await pg.end();

  // Storage cleanup
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  for (const bucket of STORAGE_BUCKETS) {
    const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1000 });
    if (error) { console.warn(`  storage ${bucket}: ${error.message}`); continue; }
    if (!data?.length) continue;
    // Recursively collect all paths
    const allPaths: string[] = [];
    async function walk(prefix: string) {
      const { data: entries } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
      if (!entries) return;
      for (const e of entries) {
        const full = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.id === null) await walk(full);  // folder
        else allPaths.push(full);
      }
    }
    await walk("");
    if (allPaths.length > 0) {
      const { error: rmErr } = await supabase.storage.from(bucket).remove(allPaths);
      if (rmErr) console.warn(`  storage ${bucket} remove: ${rmErr.message}`);
      else console.log(`  storage ${bucket}: ${allPaths.length} files removed`);
    }
  }

  console.log("\n✓ Reset done — bereit für Import");
}

main().catch((e) => { console.error(e); process.exit(1); });
