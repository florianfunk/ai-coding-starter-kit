/**
 * Zieht per FileMaker Data API die Bereich-Farben und setzt `bereiche.farbe`.
 *
 * Strategy:
 *   1. Login bei FileMaker
 *   2. API_Bereiche abrufen — erstmal nur erste Row als Schema-Inspektion
 *   3. Je nach Feld-Namen (`Farbfeld`, `Farbfeld_berechung`, `Farbe`, etc.):
 *      - direkter Hex-String → uppercase'n
 *      - Fremdschlüssel auf Farbfeld → via public.farbfelder auflösen
 *      - Index (1..20) → farbfelder.name='1'..'20' matchen
 *   4. UPDATE bereiche SET farbe = hex WHERE external_id = fmId
 *
 * Usage:
 *   npx tsx scripts/sync-bereich-farben-dataapi.ts --dry-run
 *   npx tsx scripts/sync-bereich-farben-dataapi.ts
 */
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const DRY = process.argv.includes("--dry-run");
const FM_HOST = process.env.FM_HOST!;
const FM_DATABASE = process.env.FM_DATABASE!;
const FM_USERNAME = process.env.FM_USERNAME!;
const FM_PASSWORD = process.env.FM_PASSWORD!;
const DB_ENC = encodeURIComponent(FM_DATABASE);

async function fmLogin(): Promise<string> {
  const res = await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${FM_USERNAME}:${FM_PASSWORD}`).toString("base64"),
    },
    body: "{}",
  });
  const json = await res.json();
  if (!json.response?.token) throw new Error(`FM login failed: ${JSON.stringify(json.messages)}`);
  return json.response.token;
}

async function fmLogout(token: string) {
  await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions/${token}`, { method: "DELETE" });
}

async function fmFetchAll(layout: string, token: string): Promise<any[]> {
  const all: any[] = [];
  const pageSize = 1000;
  let offset = 1;
  while (true) {
    const url = `${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/layouts/${layout}/records?_limit=${pageSize}&_offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.messages?.[0]?.code === "401") return all;
    if (!json.response?.data) throw new Error(`fmFetchAll(${layout}) failed: ${JSON.stringify(json.messages)}`);
    for (const row of json.response.data) all.push(row.fieldData);
    if (json.response.data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

function normalizeHex(raw: unknown): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  const m = t.match(/^#?([0-9A-Fa-f]{6})$/);
  return m ? "#" + m[1].toUpperCase() : null;
}

async function main() {
  console.log("FileMaker Login…");
  const token = await fmLogin();

  try {
    console.log("Fetching API_Bereiche…");
    const rows = await fmFetchAll("API_Bereiche", token);
    console.log(`  ${rows.length} Bereiche erhalten`);

    if (rows.length === 0) {
      console.log("Keine Bereiche — Abbruch.");
      return;
    }

    // Schema-Inspektion
    console.log("\n=== Feld-Liste aus erstem Row ===");
    for (const k of Object.keys(rows[0]).sort()) {
      const v = rows[0][k];
      const s = v == null ? "null" : String(v).slice(0, 60);
      console.log(`  ${k.padEnd(35)} = ${s}`);
    }

    // DB-Verbindung + farbfelder vorab laden für Lookup
    const url = process.env.POSTGRES_URL_NON_POOLING!.replace(/[?&]sslmode=[^&]+/g, "");
    const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await pg.connect();
    const ff = await pg.query(`select external_id, name, code from public.farbfelder`);
    const byExt = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const r of ff.rows) {
      if (r.external_id && r.code) byExt.set(String(r.external_id), r.code);
      if (r.name && r.code) byName.set(String(r.name), r.code);
    }
    console.log(`\n  Lookup: ${byExt.size} farbfelder per external_id, ${byName.size} per name`);

    // Pro Bereich Farbe auflösen
    const updates: { ext: string; name: string; hex: string; source: string }[] = [];
    const unresolved: { ext: string; name: string; reason: string }[] = [];
    for (const r of rows) {
      const ext = String(r.ID ?? "");
      const bname = String(r.Name ?? "(ohne Name)");
      if (!ext) continue;

      // Versuch 1: Direkter Hex in Farbfeld
      const raw = r.Farbfeld;
      let hex = normalizeHex(raw);
      let source = "direct Farbfeld hex";

      // Versuch 2: Farbfeld = fremdschlüssel auf farbfelder.external_id
      if (!hex && raw != null && String(raw).trim()) {
        const code = byExt.get(String(raw).trim());
        if (code) { hex = normalizeHex(code); source = "Farbfeld→farbfelder.external_id"; }
      }

      // Versuch 3: Farbfeld = name "1".."20" → farbfelder.name
      if (!hex && raw != null && String(raw).trim()) {
        const code = byName.get(String(raw).trim());
        if (code) { hex = normalizeHex(code); source = "Farbfeld→farbfelder.name"; }
      }

      // Versuch 4: Feld heißt anders (Farbfeld_berechung, Farbe, etc.)
      if (!hex) {
        for (const key of Object.keys(r)) {
          if (!/farb/i.test(key)) continue;
          const v = r[key];
          const h = normalizeHex(v);
          if (h) { hex = h; source = `${key} (direct hex)`; break; }
          if (v != null && String(v).trim()) {
            const code = byExt.get(String(v).trim()) ?? byName.get(String(v).trim());
            if (code) { hex = normalizeHex(code); source = `${key}→farbfelder`; break; }
          }
        }
      }

      if (hex) updates.push({ ext, name: bname, hex, source });
      else unresolved.push({ ext, name: bname, reason: `Farbfeld=${JSON.stringify(raw)}` });
    }

    console.log(`\n=== Auflösung ===`);
    for (const u of updates) {
      console.log(`  ${u.name.padEnd(32)} → ${u.hex}   (${u.source})`);
    }
    if (unresolved.length) {
      console.log(`\n=== Nicht aufgelöst ===`);
      for (const u of unresolved) {
        console.log(`  ${u.name.padEnd(32)} ${u.reason}`);
      }
    }

    if (DRY) {
      console.log("\n(dry run — keine DB-Writes)");
      await pg.end();
      return;
    }

    let updated = 0;
    let notFound = 0;
    for (const u of updates) {
      const res = await pg.query(
        `update public.bereiche set farbe = $1 where external_id = $2`,
        [u.hex, u.ext],
      );
      if (res.rowCount && res.rowCount > 0) updated += res.rowCount;
      else notFound += 1;
    }
    await pg.end();
    console.log(`\n${updated} Bereiche aktualisiert, ${notFound} nicht in DB gefunden.`);
  } finally {
    await fmLogout(token);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
