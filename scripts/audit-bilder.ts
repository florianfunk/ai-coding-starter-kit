/**
 * Kompletter Bilder-Abgleich zwischen FileMaker und Supabase.
 *
 * Für jede Bildquelle (Icons, Bereiche, Kategorien, Produkte, System-Logos):
 *   1. FM-Container: hat FM für diesen Record diese Container-URL?
 *   2. DB-Referenz:  ist bildN_path in Supabase gesetzt?
 *   3. Storage:      existiert die Datei wirklich im Bucket?
 *
 * Output: Diskrepanzen pro Kategorie, inkl. Gesamtsummen.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const FM_HOST = process.env.FM_HOST!;
const FM_DATABASE = process.env.FM_DATABASE!;
const FM_USERNAME = process.env.FM_USERNAME!;
const FM_PASSWORD = process.env.FM_PASSWORD!;
const DB_ENC = encodeURIComponent(FM_DATABASE);

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
  if (fmToken) {
    await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions/${fmToken}`, { method: "DELETE" });
  }
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

/** Prüft per Storage API, welche Pfade wirklich existieren (batched). */
async function storageExists(bucket: string, paths: string[]): Promise<Set<string>> {
  // Gruppiere Pfade nach Ordner, listet Ordnerinhalte, checkt Existenz
  const byFolder = new Map<string, Set<string>>();
  for (const p of paths) {
    const slash = p.lastIndexOf("/");
    const folder = slash >= 0 ? p.slice(0, slash) : "";
    const file = slash >= 0 ? p.slice(slash + 1) : p;
    if (!byFolder.has(folder)) byFolder.set(folder, new Set());
    byFolder.get(folder)!.add(file);
  }
  const existing = new Set<string>();
  for (const [folder, files] of byFolder) {
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: pageSize, offset });
      if (error) { console.warn(`list ${bucket}/${folder}: ${error.message}`); break; }
      if (!data || data.length === 0) break;
      for (const f of data) {
        if (files.has(f.name)) existing.add((folder ? folder + "/" : "") + f.name);
      }
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }
  return existing;
}

type Result = {
  name: string;
  fmTotal: number;
  dbTotal: number;
  storageMissing: number;
  fmOnly: { id: string; label: string; field: string }[]; // in FM vorhanden, in DB nicht
  dbOnly: { id: string; label: string; field: string; path: string }[]; // in DB gesetzt, in FM leer
  dbBroken: { id: string; label: string; field: string; path: string }[]; // path gesetzt, aber Datei fehlt
};

async function auditSource(
  name: string,
  layout: string,
  fmIdField: string,
  fmLabelField: string,
  fields: { fm: string; db: string }[],
  bucket: string,
  dbTable: string,
): Promise<Result> {
  const fmRecords = await fmFetchAll(layout);
  const fmById = new Map<string, any>();
  for (const r of fmRecords) fmById.set(r[fmIdField], r);

  const dbCols = ["external_id", "name", ...fields.map((f) => f.db)];
  // Icons haben "label" statt "name"
  const labelCol = dbTable === "icons" ? "label" : "name";
  const selectCols = ["external_id", labelCol, ...fields.map((f) => f.db)].join(",");
  const { data: dbRecords, error } = await supabase.from(dbTable).select(selectCols);
  if (error) throw new Error(`select ${dbTable}: ${error.message}`);
  const dbById = new Map<string, any>();
  for (const r of dbRecords!) dbById.set((r as any).external_id, r);

  const result: Result = {
    name,
    fmTotal: 0,
    dbTotal: 0,
    storageMissing: 0,
    fmOnly: [],
    dbOnly: [],
    dbBroken: [],
  };
  const allDbPaths: string[] = [];
  const pathsToCheck: { id: string; label: string; field: string; path: string }[] = [];

  for (const fm of fmRecords) {
    const id = fm[fmIdField];
    const label = fm[fmLabelField] ?? "?";
    const db = dbById.get(id);
    for (const f of fields) {
      const fmHas = !!fm[f.fm];
      const dbPath = db?.[f.db] as string | null | undefined;
      if (fmHas) result.fmTotal++;
      if (dbPath) {
        result.dbTotal++;
        pathsToCheck.push({ id, label, field: f.db, path: dbPath });
        allDbPaths.push(dbPath);
      }
      if (fmHas && !dbPath) result.fmOnly.push({ id, label, field: f.fm });
      if (!fmHas && dbPath) result.dbOnly.push({ id, label, field: f.db, path: dbPath });
    }
  }

  if (allDbPaths.length) {
    const existing = await storageExists(bucket, allDbPaths);
    for (const p of pathsToCheck) {
      if (!existing.has(p.path)) {
        result.storageMissing++;
        result.dbBroken.push(p);
      }
    }
  }

  return result;
}

async function main() {
  await fmLogin();
  console.log("✓ FM login\n");

  const results: Result[] = [];

  // Icons
  results.push(
    await auditSource("Icons", "API_Icons", "ID_Icon", "Icon_Name", [{ fm: "Icon_Bild", db: "symbol_path" }], "produktbilder", "icons"),
  );

  // Bereiche
  results.push(
    await auditSource("Bereiche", "API_Bereiche", "ID", "Name", [{ fm: "Bild", db: "bild_path" }], "produktbilder", "bereiche"),
  );

  // Kategorien (4 Slots)
  results.push(
    await auditSource(
      "Kategorien",
      "API_Kategorien",
      "ID",
      "Name",
      [
        { fm: "Bild1", db: "bild1_path" },
        { fm: "Bild2", db: "bild2_path" },
        { fm: "Bild3", db: "bild3_path" },
        { fm: "Bild4", db: "bild4_path" },
      ],
      "produktbilder",
      "kategorien",
    ),
  );

  // Produkte (7 Slots)
  results.push(
    await auditSource(
      "Produkte",
      "API_Artikel",
      "ID",
      "Name",
      [
        { fm: "Bild", db: "hauptbild_path" },
        { fm: "Bild_Detail_1", db: "bild_detail_1_path" },
        { fm: "Bild_Detail_2", db: "bild_detail_2_path" },
        { fm: "Bild_Zeichnung_1", db: "bild_zeichnung_1_path" },
        { fm: "Bild_Zeichnung_2", db: "bild_zeichnung_2_path" },
        { fm: "Bild_Zeichnung_3", db: "bild_zeichnung_3_path" },
        { fm: "Bild_Energielabel", db: "bild_energielabel_path" },
      ],
      "produktbilder",
      "produkte",
    ),
  );

  // Report
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│ QUELLE       │ FM Bilder │ DB Refs │ Storage missing │ Δ FM→DB │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  for (const r of results) {
    const delta = r.fmOnly.length;
    console.log(
      `│ ${r.name.padEnd(13)}│ ${String(r.fmTotal).padStart(9)} │ ${String(r.dbTotal).padStart(7)} │ ${String(r.storageMissing).padStart(15)} │ ${String(delta).padStart(7)} │`,
    );
  }
  console.log("└─────────────────────────────────────────────────────────────────┘");

  // Details
  for (const r of results) {
    if (r.fmOnly.length || r.dbBroken.length || r.dbOnly.length) {
      console.log(`\n━━━ ${r.name} ━━━`);
      if (r.fmOnly.length) {
        console.log(`FM hat, DB fehlt (${r.fmOnly.length}):`);
        for (const x of r.fmOnly.slice(0, 20)) console.log(`  ${x.label.padEnd(40)} ${x.field}`);
        if (r.fmOnly.length > 20) console.log(`  ... +${r.fmOnly.length - 20} weitere`);
      }
      if (r.dbBroken.length) {
        console.log(`DB hat Pfad, Storage fehlt (${r.dbBroken.length}):`);
        for (const x of r.dbBroken.slice(0, 20)) console.log(`  ${x.label.padEnd(40)} ${x.field}  ${x.path}`);
        if (r.dbBroken.length > 20) console.log(`  ... +${r.dbBroken.length - 20} weitere`);
      }
      if (r.dbOnly.length) {
        console.log(`DB hat Pfad, FM leer (${r.dbOnly.length}):`);
        for (const x of r.dbOnly.slice(0, 5)) console.log(`  ${x.label.padEnd(40)} ${x.field}  ${x.path}`);
        if (r.dbOnly.length > 5) console.log(`  ... +${r.dbOnly.length - 5} weitere`);
      }
    }
  }

  await fmLogout();
}

main().catch((e) => { console.error(e); process.exit(1); });
