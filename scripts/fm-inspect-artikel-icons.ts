/**
 * Inspiziert das Artikel-Layout (API_Artikel) in FileMaker
 * und listet alle Felder, die mit "Icon" beginnen.
 * Zeigt zusätzlich ein Beispiel-Datensatz mit Icon-Werten != null.
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
    `${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/layouts/API_Artikel/records?_limit=2000`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const json = await res.json();
  const records = json.response.data;
  console.log(`  ${records.length} Artikel geladen`);

  const fieldNames = Object.keys(records[0].fieldData).sort();
  const iconFields = fieldNames.filter((f) => /^Icon/i.test(f));
  console.log("\nAlle Icon-Felder im API_Artikel-Layout:");
  for (const f of iconFields) console.log("  " + f);

  // Ein Datensatz mit möglichst vielen nicht-leeren Icon-Werten
  let best: any = null;
  let bestCount = 0;
  for (const r of records) {
    const cnt = iconFields.filter((f) => {
      const v = r.fieldData[f];
      return v !== "" && v !== null && v !== undefined;
    }).length;
    if (cnt > bestCount) {
      bestCount = cnt;
      best = r;
    }
  }
  if (best) {
    console.log("\n--- Beispiel-Artikel mit vielen Icon-Feldern ---");
    console.log("  Name:", best.fieldData.Name || best.fieldData.Artikel_Name || "");
    console.log("  Artikelnummer:", best.fieldData.Artikelnummer || "");
    for (const f of iconFields) {
      const v = best.fieldData[f];
      if (v !== "" && v !== null && v !== undefined) {
        console.log(`  ${f.padEnd(28)} ${v}`);
      }
    }
  }

  await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions/${token}`, { method: "DELETE" });
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
