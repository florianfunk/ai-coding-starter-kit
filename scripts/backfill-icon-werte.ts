/**
 * Backfill: überträgt die Freitext-Werte unter den Produkt-Icons
 * (FileMaker-Felder Icon_Wert_1..Icon_Wert_10) in die neue Spalte
 * public.produkt_icons.wert.
 *
 * Idempotent: update-only, keine Neuanlage/Delete von Zuordnungen.
 * Läuft gegen die existierenden external_id-Mappings:
 *   - produkte.external_id  = FileMaker Artikel-ID
 *   - icons.external_id     = FileMaker Icon-ID
 *
 * Usage:
 *   npx tsx scripts/backfill-icon-werte.ts
 *   npx tsx scripts/backfill-icon-werte.ts --dry-run
 */
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");

async function fmLogin(): Promise<{ token: string; dbEnc: string; host: string }> {
  const FM_HOST = process.env.FM_HOST!;
  const FM_DATABASE = process.env.FM_DATABASE!;
  const FM_USERNAME = process.env.FM_USERNAME!;
  const FM_PASSWORD = process.env.FM_PASSWORD!;
  const dbEnc = encodeURIComponent(FM_DATABASE);
  const res = await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${dbEnc}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${FM_USERNAME}:${FM_PASSWORD}`).toString("base64"),
    },
    body: "{}",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`FM login failed: ${JSON.stringify(json)}`);
  return { token: json.response.token, dbEnc, host: FM_HOST };
}

async function fmLogout(ctx: { token: string; dbEnc: string; host: string }) {
  await fetch(`${ctx.host}/fmi/data/vLatest/databases/${ctx.dbEnc}/sessions/${ctx.token}`, {
    method: "DELETE",
  }).catch(() => {});
}

async function fmFetchAllArtikel(ctx: { token: string; dbEnc: string; host: string }) {
  const all: any[] = [];
  let offset = 1;
  const limit = 500;
  for (;;) {
    const url = `${ctx.host}/fmi/data/vLatest/databases/${ctx.dbEnc}/layouts/API_Artikel/records?_offset=${offset}&_limit=${limit}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${ctx.token}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(`FM fetch failed: ${JSON.stringify(json)}`);
    const batch: any[] = json.response?.data ?? [];
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return all;
}

async function main() {
  const pgUrl = process.env.POSTGRES_URL_NON_POOLING!.replace(/[?&]sslmode=[^&]+/g, "");
  const pg = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await pg.connect();

  const ctx = await fmLogin();
  console.log(`${DRY_RUN ? "[DRY-RUN] " : ""}FileMaker-Session OK`);

  try {
    const records = await fmFetchAllArtikel(ctx);
    console.log(`  ${records.length} Artikel aus FileMaker geladen`);

    // Map: FM-Artikel-ID → Supabase-produkt-uuid
    const artRes = await pg.query<{ id: string; external_id: string }>(
      `select id, external_id from public.produkte where external_id is not null`,
    );
    const produktMap = new Map(artRes.rows.map((r) => [r.external_id, r.id]));

    // Map: FM-Icon-ID → Supabase-icon-uuid
    const iconRes = await pg.query<{ id: string; external_id: string }>(
      `select id, external_id from public.icons where external_id is not null`,
    );
    const iconMap = new Map(iconRes.rows.map((r) => [r.external_id, r.id]));

    let updated = 0;
    let skippedNoProdukt = 0;
    let skippedNoIcon = 0;
    let skippedNoRow = 0;
    let emptyValues = 0;

    for (const r of records) {
      const fm = r.fieldData;
      const artikelFmId = fm.ID ?? fm.ID_Artikel ?? fm.__ID_Artikel;
      const produktUuid = artikelFmId ? produktMap.get(String(artikelFmId)) : undefined;
      if (!produktUuid) {
        skippedNoProdukt++;
        continue;
      }

      for (let i = 1; i <= 10; i++) {
        const iconFmId = fm[`Icon${i}_ID`];
        if (!iconFmId) continue;
        const iconUuid = iconMap.get(String(iconFmId));
        if (!iconUuid) {
          skippedNoIcon++;
          continue;
        }
        const rawWert = fm[`Icon_Wert_${i}`];
        const wert =
          rawWert === "" || rawWert === null || rawWert === undefined
            ? null
            : String(rawWert).trim() || null;
        if (wert === null) {
          emptyValues++;
          continue; // nichts zu schreiben
        }

        if (DRY_RUN) {
          updated++;
          continue;
        }
        const res = await pg.query(
          `update public.produkt_icons
              set wert = $3
            where produkt_id = $1 and icon_id = $2`,
          [produktUuid, iconUuid, wert],
        );
        if (res.rowCount && res.rowCount > 0) updated++;
        else skippedNoRow++;
      }
    }

    console.log("\n=== Backfill abgeschlossen ===");
    console.log(`  Werte geschrieben:           ${updated}`);
    console.log(`  leere Werte (übersprungen):  ${emptyValues}`);
    console.log(`  Artikel nicht in Supabase:   ${skippedNoProdukt}`);
    console.log(`  Icon nicht in Supabase:      ${skippedNoIcon}`);
    console.log(`  Zuordnung fehlt in DB:       ${skippedNoRow}`);
    if (DRY_RUN) console.log("  (dry-run — keine Writes)");
  } finally {
    await fmLogout(ctx);
    await pg.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
