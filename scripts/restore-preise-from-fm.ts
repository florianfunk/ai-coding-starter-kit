/**
 * Restore: EK-Preise aus FileMaker neu einlesen.
 *
 * Hintergrund: Migration 0020 (preise_drei_spuren) hat alle alten preise-Zeilen
 * als spur='listenpreis' mapped, auch die EK-Zeilen. Dadurch sind die Werte
 * EK_Lichtengros und EK_Eisenkeil aus der DB verschwunden.
 *
 * Dieses Script liest die FM-Preise direkt via Data API und schreibt sie
 * in das neue Schema (produkt_id, spur, gueltig_ab, preis, quelle, external_id).
 *
 * Idempotent: ON CONFLICT (external_id) DO UPDATE
 */
import { config } from "dotenv";
import { Client } from "pg";
// Use Node TLS relaxation for Supabase self-signed chain
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

config({ path: ".env.local" });

const FM_HOST = process.env.FM_HOST!;
const FM_DATABASE = process.env.FM_DATABASE!;
const FM_USERNAME = process.env.FM_USERNAME!;
const FM_PASSWORD = process.env.FM_PASSWORD!;
const DB_ENC = encodeURIComponent(FM_DATABASE);

function parseDate(v: any): string | null {
  // FM liefert MM/DD/YYYY
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

function toNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // 1) FM Login
  const login = await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${FM_USERNAME}:${FM_PASSWORD}`).toString("base64"),
    },
    body: "{}",
  });
  const token = (await login.json()).response.token;

  // 2) Alle Preise holen
  let offset = 1;
  const limit = 100;
  const all: any[] = [];
  while (true) {
    const res = await fetch(
      `${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/layouts/API_Preise/records?_limit=${limit}&_offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const json = await res.json();
    const rows = json.response?.data ?? [];
    if (!rows.length) break;
    all.push(...rows.map((r: any) => r.fieldData));
    if (rows.length < limit) break;
    offset += limit;
  }
  console.log(`Fetched ${all.length} Preise from FileMaker`);

  // 3) Postgres
  const pgUrl =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL;
  if (!pgUrl) throw new Error("Missing DB connection string in .env.local");
  const pg = new Client({ connectionString: pgUrl });
  await pg.connect();

  // Artikel_ID -> produkt_id Map
  const artMap = new Map<string, string>();
  const { rows: artRows } = await pg.query(`select external_id, id from public.produkte`);
  for (const r of artRows) artMap.set(r.external_id, r.id);

  let inserted = 0, updated = 0, skipped = 0;
  const spuren = { listenpreis: 0, lichtengros: 0, eisenkeil: 0 };

  for (const r of all) {
    const artikelUuid = artMap.get(r.Artikel_ID);
    if (!artikelUuid) {
      skipped++;
      continue;
    }
    const gueltig = parseDate(r.Gueltigkeitsdatum) ?? new Date().toISOString().slice(0, 10);
    const listen = toNum(r.Listenpreis);
    const ekLG = toNum(r.EK_Lichtengros);
    const ekEK = toNum(r.EK_Eisenkeil);
    const rowId = r.ID; // external_id

    // Jede FM-Zeile wird zu EINER Supabase-Zeile. Spur nach Priorität:
    // Wenn listenpreis gesetzt (auch 0) → listenpreis; sonst EK_LG → lichtengros; sonst EK_EK → eisenkeil.
    let spur: "listenpreis" | "lichtengros" | "eisenkeil";
    let preis: number;
    if (listen !== null) {
      spur = "listenpreis";
      preis = listen;
    } else if (ekLG !== null) {
      spur = "lichtengros";
      preis = ekLG;
    } else if (ekEK !== null) {
      spur = "eisenkeil";
      preis = ekEK;
    } else {
      skipped++;
      continue;
    }
    spuren[spur]++;

    if (dryRun) {
      inserted++;
      continue;
    }

    const res = await pg.query(
      `insert into public.preise
         (external_id, produkt_id, spur, gueltig_ab, preis, quelle)
       values ($1, $2, $3::public.preis_spur, $4, $5, 'fm-restore-2026-04-24')
       on conflict (external_id) do update set
         produkt_id = excluded.produkt_id,
         spur = excluded.spur,
         gueltig_ab = excluded.gueltig_ab,
         preis = excluded.preis,
         quelle = excluded.quelle
       returning (xmax = 0) as is_insert`,
      [rowId, artikelUuid, spur, gueltig, preis],
    );
    if (res.rows[0].is_insert) inserted++; else updated++;
  }

  await pg.end();

  await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions/${token}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`\nResult: inserted=${inserted}  updated=${updated}  skipped=${skipped}`);
  console.log(`  Spuren: listenpreis=${spuren.listenpreis}  lichtengros=${spuren.lichtengros}  eisenkeil=${spuren.eisenkeil}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
