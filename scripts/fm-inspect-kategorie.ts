/**
 * Sammelt alle Felder einer FileMaker-Kategorie (z.B. Tina) und zeigt welche Container-URLs liefern.
 */
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
  const json = await res.json();
  const records = json.response.data;

  // Filter nur Tina (+ zeige generell alle Feldnamen mit Containern)
  const nameKey = Object.keys(records[0].fieldData).find((k) => k.toLowerCase() === "name")!;
  const tina = records.find((r: any) => r.fieldData[nameKey] === "Tina");

  // 1. Alle Feldnamen auflisten
  const fieldNames = Object.keys(records[0].fieldData).sort();
  console.log(`Alle Felder im API_Kategorien-Layout (${fieldNames.length}):`);
  for (const f of fieldNames) console.log(`  ${f}`);

  // 2. Alle Container-Felder (Werte beginnen mit http...)
  console.log("\n--- Container-Felder (URL-Werte) über alle Datensätze ---");
  const containerFields = new Set<string>();
  for (const r of records) {
    for (const [k, v] of Object.entries(r.fieldData)) {
      if (typeof v === "string" && v.startsWith("http")) containerFields.add(k);
    }
  }
  for (const f of Array.from(containerFields).sort()) console.log(`  ${f}`);

  // 3. Tina komplett
  if (tina) {
    console.log("\n--- Tina komplett ---");
    for (const [k, v] of Object.entries(tina.fieldData).sort()) {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      const val = s.length > 80 ? s.slice(0, 80) + "…" : s;
      console.log(`  ${k.padEnd(30)} ${val}`);
    }
  } else {
    console.log("\n(Tina nicht gefunden)");
  }

  await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions/${token}`, { method: "DELETE" });
}
main();
