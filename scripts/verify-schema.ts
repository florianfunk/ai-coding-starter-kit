import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const url = process.env.POSTGRES_URL_NON_POOLING!.replace(/[?&]sslmode=[^&]+/g, "");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = await client.query(`
    select table_name from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE'
    order by table_name`);
  const buckets = await client.query(`select id from storage.buckets order by id`);
  const policies = await client.query(`
    select tablename, count(*) as policies
    from pg_policies where schemaname='public' group by tablename order by tablename`);

  console.log("Tables:", tables.rows.map((r) => r.table_name).join(", "));
  console.log("Buckets:", buckets.rows.map((r) => r.id).join(", "));
  console.log("RLS policies per table:");
  for (const r of policies.rows) console.log(`  ${r.tablename}: ${r.policies}`);

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
