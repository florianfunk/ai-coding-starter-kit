/**
 * Applies all SQL files from supabase/migrations/ to the database in order.
 * Idempotent: tracks applied files in table public._migrations.
 *
 * Usage:  npx tsx scripts/apply-migrations.ts
 */
import { Client } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

async function main() {
  const url = process.env.POSTGRES_URL_NON_POOLING;
  if (!url) throw new Error("POSTGRES_URL_NON_POOLING fehlt in .env.local");

  const cleanUrl = url.replace(/[?&]sslmode=[^&]+/g, "");
  const client = new Client({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    create table if not exists public._migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = new Set(
    (await client.query<{ filename: string }>(`select filename from public._migrations`)).rows.map(
      (r) => r.filename,
    ),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`✓ ${file} (already applied)`);
      continue;
    }
    console.log(`→ applying ${file}…`);
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(`insert into public._migrations (filename) values ($1)`, [file]);
      await client.query("commit");
      console.log(`✓ ${file} applied`);
    } catch (err) {
      await client.query("rollback");
      console.error(`✗ ${basename(file)} failed:`, err);
      process.exit(1);
    }
  }

  await client.end();
  console.log("\nAll migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
