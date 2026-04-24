/**
 * Bereinigt verwaiste Bild-Referenzen: in Supabase ist bildN_path gesetzt,
 * in FileMaker ist der Container aber leer (= dort gelöscht).
 *
 * Schritte:
 *  1. Finde betroffene Zeilen (wie audit-bilder.ts, aber fokussiert auf dbOnly)
 *  2. Setze bildN_path = NULL in der DB
 *  3. Lösche die Datei im Storage
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const FM_HOST = process.env.FM_HOST!;
const FM_DATABASE = process.env.FM_DATABASE!;
const FM_USERNAME = process.env.FM_USERNAME!;
const FM_PASSWORD = process.env.FM_PASSWORD!;
const DB_ENC = encodeURIComponent(FM_DATABASE);

const DRY_RUN = process.argv.includes("--dry-run");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

let fmToken: string | null = null;

async function fmLogin() {
  const res = await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${FM_USERNAME}:${FM_PASSWORD}`).toString("base64"),
    },
    body: "{}",
  });
  fmToken = (await res.json()).response.token;
}
async function fmLogout() {
  if (fmToken) await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions/${fmToken}`, { method: "DELETE" });
}
async function fmFetchAll(layout: string): Promise<any[]> {
  const all: any[] = [];
  let offset = 1;
  const pageSize = 1000;
  while (true) {
    const res = await fetch(
      `${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/layouts/${layout}/records?_limit=${pageSize}&_offset=${offset}`,
      { headers: { Authorization: `Bearer ${fmToken}` } },
    );
    const json = await res.json();
    if (json.messages?.[0]?.code === "401") return all;
    if (!json.response?.data) throw new Error(`fetch ${layout} failed`);
    for (const row of json.response.data) all.push(row.fieldData);
    if (json.response.data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

type Source = {
  layout: string;
  fmIdField: string;
  dbTable: string;
  labelCol: string;
  fields: { fm: string; db: string }[];
  bucket: string;
};

const SOURCES: Source[] = [
  {
    layout: "API_Icons",
    fmIdField: "ID_Icon",
    dbTable: "icons",
    labelCol: "label",
    fields: [{ fm: "Icon_Bild", db: "symbol_path" }],
    bucket: "produktbilder",
  },
  {
    layout: "API_Bereiche",
    fmIdField: "ID",
    dbTable: "bereiche",
    labelCol: "name",
    fields: [{ fm: "Bild", db: "bild_path" }],
    bucket: "produktbilder",
  },
  {
    layout: "API_Kategorien",
    fmIdField: "ID",
    dbTable: "kategorien",
    labelCol: "name",
    fields: [
      { fm: "Bild1", db: "bild1_path" },
      { fm: "Bild2", db: "bild2_path" },
      { fm: "Bild3", db: "bild3_path" },
      { fm: "Bild4", db: "bild4_path" },
    ],
    bucket: "produktbilder",
  },
  {
    layout: "API_Artikel",
    fmIdField: "ID",
    dbTable: "produkte",
    labelCol: "name",
    fields: [
      { fm: "Bild", db: "hauptbild_path" },
      { fm: "Bild_Detail_1", db: "bild_detail_1_path" },
      { fm: "Bild_Detail_2", db: "bild_detail_2_path" },
      { fm: "Bild_Zeichnung_1", db: "bild_zeichnung_1_path" },
      { fm: "Bild_Zeichnung_2", db: "bild_zeichnung_2_path" },
      { fm: "Bild_Zeichnung_3", db: "bild_zeichnung_3_path" },
      { fm: "Bild_Energielabel", db: "bild_energielabel_path" },
    ],
    bucket: "produktbilder",
  },
];

async function main() {
  await fmLogin();
  console.log(DRY_RUN ? "DRY-RUN (nichts wird geändert)\n" : "LIVE\n");

  let totalOrphans = 0;
  let totalCleaned = 0;
  let totalStorageDeleted = 0;

  for (const src of SOURCES) {
    const fmRecords = await fmFetchAll(src.layout);
    const fmById = new Map<string, any>();
    for (const r of fmRecords) fmById.set(r[src.fmIdField], r);

    const selectCols = ["id", "external_id", src.labelCol, ...src.fields.map((f) => f.db)].join(",");
    const { data: dbRecords, error } = await supabase.from(src.dbTable).select(selectCols);
    if (error) throw new Error(`select ${src.dbTable}: ${error.message}`);

    type Orphan = { id: string; label: string; col: string; path: string };
    const orphans: Orphan[] = [];

    for (const r of dbRecords!) {
      const row = r as any;
      const fm = fmById.get(row.external_id);
      for (const f of src.fields) {
        const dbPath = row[f.db] as string | null;
        const fmHas = fm ? !!fm[f.fm] : false; // kein FM-Record = auch dort weg
        if (dbPath && !fmHas) {
          orphans.push({ id: row.id, label: row[src.labelCol] ?? "?", col: f.db, path: dbPath });
        }
      }
    }

    console.log(`━━ ${src.dbTable} (${orphans.length} verwaiste Referenzen) ━━`);
    totalOrphans += orphans.length;
    if (orphans.length === 0) continue;

    for (const o of orphans) console.log(`  ${o.label.padEnd(40)} ${o.col.padEnd(25)} ${o.path}`);

    if (DRY_RUN) continue;

    // 1. DB-Spalten auf NULL setzen (gruppiert pro Zeile, um mehrere cols auf einmal zu löschen)
    const patchByRow = new Map<string, Record<string, null>>();
    for (const o of orphans) {
      if (!patchByRow.has(o.id)) patchByRow.set(o.id, {});
      patchByRow.get(o.id)![o.col] = null;
    }
    for (const [id, patch] of patchByRow) {
      const { error: updErr } = await supabase.from(src.dbTable).update(patch).eq("id", id);
      if (updErr) { console.warn(`  update ${id} failed: ${updErr.message}`); continue; }
      totalCleaned += Object.keys(patch).length;
    }

    // 2. Storage-Dateien entfernen
    const paths = orphans.map((o) => o.path);
    const { data: removed, error: remErr } = await supabase.storage.from(src.bucket).remove(paths);
    if (remErr) console.warn(`  storage delete failed: ${remErr.message}`);
    else totalStorageDeleted += removed?.length ?? 0;
  }

  console.log(`\n━━━ Zusammenfassung ━━━`);
  console.log(`  verwaiste Referenzen gefunden: ${totalOrphans}`);
  if (!DRY_RUN) {
    console.log(`  DB-Spalten geleert:            ${totalCleaned}`);
    console.log(`  Storage-Dateien gelöscht:      ${totalStorageDeleted}`);
  }

  await fmLogout();
}

main().catch((e) => { console.error(e); process.exit(1); });
