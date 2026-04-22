/**
 * Schaut in Supabase-DB nach:
 *   - welche Bereiche (20) welche `farbe` haben
 *   - welche `farbfelder` existieren (mit code/rgb)
 *   - ob es auf Bereichen ein Feld gibt, das auf farbfelder verweist
 *
 * Usage: npx tsx scripts/inspect-bereich-farben.ts
 */
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const url = process.env.POSTGRES_URL_NON_POOLING!.replace(/[?&]sslmode=[^&]+/g, "");
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();

  // 1. Bereich-Spalten
  const cols = await pg.query(
    `select column_name, data_type from information_schema.columns
     where table_schema='public' and table_name='bereiche'
     order by ordinal_position`,
  );
  console.log("\n=== bereiche columns ===");
  for (const c of cols.rows) console.log(`  ${c.column_name.padEnd(30)} ${c.data_type}`);

  // 2. Bereich-Daten
  const bereiche = await pg.query(
    `select id, external_id, name, farbe from public.bereiche order by sortierung, name`,
  );
  console.log(`\n=== bereiche data (${bereiche.rows.length}) ===`);
  for (const r of bereiche.rows) {
    console.log(`  ${r.name.padEnd(30)} ext=${(r.external_id ?? "").slice(0, 8)}  farbe=${r.farbe ?? "(null)"}`);
  }

  // 3. farbfelder
  const farben = await pg.query(`select * from public.farbfelder order by name limit 50`);
  console.log(`\n=== farbfelder (${farben.rows.length}) ===`);
  for (const f of farben.rows) {
    console.log(`  ${String(f.name).padEnd(30)} code="${f.code ?? ""}" rgb="${f.rgb ?? ""}"`);
  }

  await pg.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
