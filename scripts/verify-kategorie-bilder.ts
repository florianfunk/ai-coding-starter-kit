/**
 * Vergleicht pro Kategorie die Anzahl Bild-Container in FileMaker
 * mit der Anzahl der befüllten bildN_path-Spalten in Supabase.
 * Zeigt Diskrepanzen.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

async function main() {
  config({ path: ".env.local" });
  const FM_HOST = process.env.FM_HOST!;
  const FM_DATABASE = process.env.FM_DATABASE!;
  const FM_USERNAME = process.env.FM_USERNAME!;
  const FM_PASSWORD = process.env.FM_PASSWORD!;
  const DB_ENC = encodeURIComponent(FM_DATABASE);

  const login = await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${FM_USERNAME}:${FM_PASSWORD}`).toString("base64"),
    },
    body: "{}",
  });
  const token = (await login.json()).response.token;

  const res = await fetch(
    `${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/layouts/API_Kategorien/records?_limit=1000`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const fmRecords = (await res.json()).response.data;

  await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions/${token}`, { method: "DELETE" });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: dbRecords } = await supabase
    .from("kategorien")
    .select("external_id, name, bild1_path, bild2_path, bild3_path, bild4_path");

  const dbById = new Map<string, any>();
  for (const r of dbRecords!) dbById.set(r.external_id, r);

  const diffs: { name: string; fmHas: number[]; dbHas: number[]; missing: number[] }[] = [];
  let fmTotal = 0;
  let dbTotal = 0;

  for (const r of fmRecords) {
    const fd = r.fieldData;
    const fmHas: number[] = [];
    for (let i = 1; i <= 4; i++) if (fd[`Bild${i}`]) fmHas.push(i);
    fmTotal += fmHas.length;

    const db = dbById.get(fd.ID);
    const dbHas: number[] = [];
    if (db) for (let i = 1; i <= 4; i++) if (db[`bild${i}_path`]) dbHas.push(i);
    dbTotal += dbHas.length;

    const missing = fmHas.filter((i) => !dbHas.includes(i));
    if (missing.length) diffs.push({ name: fd.Name ?? "?", fmHas, dbHas, missing });
  }

  console.log(`FileMaker-Bilder gesamt: ${fmTotal}`);
  console.log(`Supabase-Bilder gesamt:  ${dbTotal}`);
  console.log(`Diskrepanz:              ${fmTotal - dbTotal} fehlen`);

  if (diffs.length) {
    console.log(`\n${diffs.length} Kategorien mit fehlenden Bildern:`);
    for (const d of diffs) {
      console.log(
        `  ${d.name.padEnd(35)} FM=${d.fmHas.join(",").padEnd(7)} DB=${d.dbHas.join(",").padEnd(7)} fehlt=${d.missing.join(",")}`,
      );
    }
  } else {
    console.log("\n✓ Alle vorhandenen FileMaker-Bilder sind importiert.");
  }
}
main();
