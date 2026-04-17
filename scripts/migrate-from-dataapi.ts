/**
 * Lichtengross Produktkatalog — Migration von FileMaker Server zu Supabase
 * Quelle: FileMaker Data API (claris.sustainable.de)
 * Ziel:   Supabase (Postgres + Storage)
 *
 * Läuft in Phasen:
 *   1. Icons (fix)
 *   2. Farbfelder
 *   3. Bereiche
 *   4. Kategorien (+ kategorie_icons)
 *   5. Artikel/Produkte (+ produkt_icons + produkt_bilder)
 *   6. Preise
 *   7. Katalogseiten
 *   8. System → katalog_einstellungen (Singleton)
 *
 * Idempotent: ON CONFLICT (external_id) DO UPDATE
 *
 * Usage:
 *   npx tsx scripts/migrate-from-dataapi.ts                # alles
 *   npx tsx scripts/migrate-from-dataapi.ts --dry-run      # keine Writes in Supabase
 *   npx tsx scripts/migrate-from-dataapi.ts --limit 2      # nur 2 Bereiche (+ deren Kategorien + Artikel)
 *   npx tsx scripts/migrate-from-dataapi.ts --skip-images  # ohne Bilder-Upload
 *   npx tsx scripts/migrate-from-dataapi.ts --only bereiche,kategorien
 */
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// CLI Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SKIP_IMAGES = args.includes("--skip-images");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? Number(args[i + 1]) : null;
})();
const ONLY = (() => {
  const i = args.indexOf("--only");
  return i >= 0 ? args[i + 1].split(",") : null;
})();
function runPhase(name: string): boolean {
  return !ONLY || ONLY.includes(name);
}

// ---------------------------------------------------------------------------
// FileMaker Data API Client
// ---------------------------------------------------------------------------
const FM_HOST = process.env.FM_HOST!;
const FM_DATABASE = process.env.FM_DATABASE!;
const FM_USERNAME = process.env.FM_USERNAME!;
const FM_PASSWORD = process.env.FM_PASSWORD!;

if (!FM_HOST || !FM_DATABASE || !FM_USERNAME || !FM_PASSWORD) {
  console.error("Missing FM_* env vars. Check .env.local.");
  process.exit(1);
}

const DB_ENC = encodeURIComponent(FM_DATABASE);
let fmToken: string | null = null;

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
  if (!json.response?.token) {
    throw new Error(`FM login failed: ${JSON.stringify(json.messages)}`);
  }
  return json.response.token;
}

async function fmLogout(token: string) {
  await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions/${token}`, {
    method: "DELETE",
  });
}

/** Fetch *all* records of a layout with pagination (1000 per page). */
async function fmFetchAll(layout: string): Promise<any[]> {
  const all: any[] = [];
  const pageSize = 1000;
  let offset = 1;
  while (true) {
    const url = `${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/layouts/${layout}/records?_limit=${pageSize}&_offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${fmToken}` } });
    const json = await res.json();
    if (json.messages?.[0]?.code === "401") {
      // no records found — ok, empty
      return all;
    }
    if (!json.response?.data) {
      throw new Error(`fmFetchAll(${layout}) failed: ${JSON.stringify(json.messages)}`);
    }
    const batch = json.response.data;
    for (const row of batch) all.push(row.fieldData);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

/**
 * Download a FileMaker Container URL (Streaming_SSL).
 *
 * FileMaker erwartet ein zweistufiges Verfahren:
 *  1. GET ohne Auth -> Redirect 302 mit Set-Cookie (HttpOnly Session)
 *  2. GET dem Redirect folgen -> liefert die Binärdaten, Cookie muss gesetzt sein.
 *
 * `fetch` folgt Redirects und nimmt Set-Cookie leider NICHT automatisch mit.
 * Deshalb machen wir es manuell: ersten Request ohne redirect, Cookie extrahieren,
 * dann zweiten Request mit dem Cookie.
 */
async function fmDownloadContainer(url: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!url || !url.startsWith("http")) return null;
  try {
    const first = await fetch(url, {
      redirect: "manual",
      headers: { Authorization: `Bearer ${fmToken}` },
    });
    // Either we get 200 directly, or 302 with a Set-Cookie we must honor
    if (first.ok) {
      return {
        bytes: Buffer.from(await first.arrayBuffer()),
        contentType: first.headers.get("content-type") ?? "application/octet-stream",
      };
    }
    if (first.status === 302 || first.status === 301) {
      const loc = first.headers.get("location");
      const cookie = first.headers.get("set-cookie");
      if (!loc) {
        console.warn(`  container redirect without location: ${url.slice(0, 80)}`);
        return null;
      }
      const nextUrl = loc.startsWith("http") ? loc : new URL(loc, url).toString();
      const headers: Record<string, string> = {};
      if (cookie) headers["Cookie"] = cookie.split(";")[0];
      const second = await fetch(nextUrl, { headers, redirect: "follow" });
      if (!second.ok) {
        console.warn(`  container 2nd step ${second.status}: ${nextUrl.slice(0, 80)}`);
        return null;
      }
      return {
        bytes: Buffer.from(await second.arrayBuffer()),
        contentType: second.headers.get("content-type") ?? "application/octet-stream",
      };
    }
    console.warn(`  container download ${first.status}: ${url.slice(0, 80)}`);
    return null;
  } catch (e: any) {
    console.warn(`  container download error: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toNum(v: any): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(",", ".").replace(/[^0-9.\-eE]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function toBool(v: any): boolean {
  if (v == null || v === "") return false;
  const s = String(v).trim().toLowerCase();
  return ["1", "ja", "true", "yes", "y"].includes(s);
}
function toDate(v: any): string | null {
  if (!v) return null;
  // FM Data API uses "MM/DD/YYYY" per productInfo
  const s = String(v).trim();
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) {
    const [, mo, d, y] = m1;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const m2 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m2) {
    const [, d, mo, y] = m2;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}
function toTs(v: any): string | null {
  if (!v) return null;
  const s = String(v).trim();
  // "MM/DD/YYYY HH:mm:ss"
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (m) {
    const [, mo, d, y, h, mi, se] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${se}Z`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Supabase / Postgres
// ---------------------------------------------------------------------------
function pgClient() {
  const url = process.env.POSTGRES_URL_NON_POOLING!.replace(/[?&]sslmode=[^&]+/g, "");
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

/** Upload a FileMaker container to Supabase Storage; returns storage path (bucket-relative). */
async function uploadContainer(bucket: string, pathPrefix: string, fmUrl: string): Promise<string | null> {
  if (SKIP_IMAGES || !fmUrl) return null;
  const data = await fmDownloadContainer(fmUrl);
  if (!data) return null;
  let ext = "bin";
  if (data.contentType.includes("jpeg") || data.contentType.includes("jpg")) ext = "jpg";
  else if (data.contentType.includes("png")) ext = "png";
  else if (data.contentType.includes("gif")) ext = "gif";
  else if (data.contentType.includes("webp")) ext = "webp";
  else if (data.contentType.includes("pdf")) ext = "pdf";
  const hash = createHash("sha256").update(data.bytes).digest("hex").slice(0, 16);
  const fullPath = `${pathPrefix}-${hash}.${ext}`;
  if (DRY_RUN) {
    report.bilder.skipped += 1;
    return fullPath;
  }
  const { error } = await supabase.storage.from(bucket).upload(fullPath, data.bytes, {
    contentType: data.contentType,
    upsert: true,
  });
  if (error) {
    report.bilder.failed += 1;
    console.warn(`  upload failed ${fullPath}: ${error.message}`);
    return null;
  }
  report.bilder.uploaded += 1;
  return fullPath;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
type PhaseReport = { inserted: number; updated: number; skipped: number; warnings: string[] };
const phase = (): PhaseReport => ({ inserted: 0, updated: 0, skipped: 0, warnings: [] });

const report = {
  run_at: new Date().toISOString(),
  dry_run: DRY_RUN,
  skip_images: SKIP_IMAGES,
  limit: LIMIT,
  icons: phase(),
  farbfelder: phase(),
  bereiche: phase(),
  kategorien: phase(),
  kategorie_icons: phase(),
  produkte: phase(),
  produkt_icons: phase(),
  produkt_bilder: phase(),
  preise: phase(),
  katalog_seiten: phase(),
  einstellungen: phase(),
  bilder: { uploaded: 0, failed: 0, skipped: 0 },
};

// ---------------------------------------------------------------------------
// Artikel field map (FileMaker -> Postgres column)
// ---------------------------------------------------------------------------
type Col = { col: string; type: "num" | "text" | "bool" | "int" };
const ARTIKEL_MAP: Record<string, Col> = {
  Name: { col: "name", type: "text" },
  Sortierung: { col: "sortierung", type: "int" },
  Sortierung_fest: { col: "sortierung_fest", type: "int" },
  Sortierung_alt: { col: "sortierung_alt", type: "int" },
  Sortierung_ber: { col: "sortierung_ber", type: "int" },
  Kat_Startseite: { col: "kat_startseite", type: "int" },

  Infofeld: { col: "infofeld", type: "text" },
  t__Info: { col: "info_kurz", type: "text" },
  w_Treiber: { col: "treiber", type: "text" },
  Datenblatt_art: { col: "datenblatt_art", type: "text" },
  Da_Titel: { col: "datenblatt_titel", type: "text" },
  Da_Beschreibung_1: { col: "datenblatt_text", type: "text" },

  marker_info: { col: "marker_info", type: "bool" },
  marker_1: { col: "marker_1", type: "bool" },
  marker_2: { col: "marker_2", type: "bool" },
  marker_3: { col: "marker_3", type: "bool" },
  marker_erledigt: { col: "artikel_bearbeitet", type: "bool" },
  marker_Preis_Status_aktiv: { col: "marker_preis_status", type: "bool" },
  nicht_leer: { col: "nicht_leer", type: "bool" },

  Bild_Detail_1_Text: { col: "bild_detail_1_text", type: "text" },
  Bild_Detail_2_Text: { col: "bild_detail_2_text", type: "text" },
  Bild_Detail_3_Text: { col: "bild_detail_3_text", type: "text" },

  // Elektrotechnisch
  t_e_Systemleistung: { col: "leistung_w", type: "num" },
  t_e_Nennstrom: { col: "nennstrom_a", type: "num" },
  t_e_Nennspannung: { col: "nennspannung_v", type: "num" },
  t_e_Schutzklasse: { col: "schutzklasse", type: "text" },
  t_e_Spannungsart: { col: "spannungsart", type: "text" },
  t_e_Gesamteffizienz: { col: "gesamteffizienz_lm_w", type: "num" },
  // Lichttechnisch
  t_l_Lichtstrom: { col: "lichtstrom_lm", type: "num" },
  t_l_Abstrahlwinkel: { col: "abstrahlwinkel_grad", type: "num" },
  t_l_Energieeffizienzklasse: { col: "energieeffizienzklasse", type: "text" },
  t_l_Farbtemperatur: { col: "farbtemperatur_k", type: "num" },
  t_l_Farbkonsistenz_SDCM: { col: "farbkonsistenz_sdcm", type: "text" },
  t_l_Farbwiedergabeindex_CRI: { col: "farbwiedergabeindex_cri", type: "num" },
  t_l_LED_Chip: { col: "led_chip", type: "text" },
  t_l_Lichtverteilung: { col: "lichtverteilung", type: "text" },
  t_m_Blendbegrenzung_UGR: { col: "ugr", type: "text" },
  // Mechanisch
  "w_Maße": { col: "masse_text", type: "text" },
  "t_m_Länge": { col: "laenge_mm", type: "num" },
  t_m_Breite: { col: "breite_mm", type: "num" },
  "t_m_Höhe": { col: "hoehe_mm", type: "num" },
  "t_m_Außendurchmesser": { col: "aussendurchmesser_mm", type: "num" },
  t_m_Einbaudurchmesser: { col: "einbaudurchmesser_mm", type: "num" },
  t_m_Gewicht: { col: "gewicht_g", type: "num" },
  "t_m_Gehäusefarbe": { col: "gehaeusefarbe", type: "text" },
  t_m_Montageart: { col: "montageart", type: "text" },
  t_m_Schlagfestigkeit: { col: "schlagfestigkeit", type: "text" },
  t_m_Schutzart_IP: { col: "schutzart_ip", type: "text" },
  "t_m_Werkstoff_des_Gehäuses": { col: "werkstoff_gehaeuse", type: "text" },
  t_m_Leuchtmittel: { col: "leuchtmittel", type: "text" },
  t_m_Sockel: { col: "sockel", type: "text" },
  "w_Rollenlänge": { col: "rollenlaenge_m", type: "num" },
  "t_m_maximale_Länge": { col: "maximale_laenge_m", type: "num" },
  t_m_Anzahl_der_LED_pro_Meter: { col: "anzahl_led_pro_meter", type: "num" },
  t_m_Abstand_LED_zu_LED: { col: "abstand_led_zu_led_mm", type: "num" },
  "t_m_Länge_der_einzelnen_Abschnitte": { col: "laenge_abschnitte_mm", type: "num" },
  t_m_Kleinster_Biegeradius: { col: "kleinster_biegeradius_mm", type: "num" },
  // Thermisch
  t_t_Lebensdauer: { col: "lebensdauer_h", type: "num" },
  t_t_Umgebungstemperatur: { col: "temperatur_ta", type: "text" },
  // Sonstiges
  "t_m_mit_Betriebsgerät": { col: "mit_betriebsgeraet", type: "bool" },
  t_s_Optional: { col: "optional_text", type: "text" },
  t_s_Zertifikate: { col: "zertifikate", type: "text" },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("━".repeat(72));
  console.log(`FileMaker → Supabase Migration  (${DRY_RUN ? "DRY-RUN" : "LIVE"})`);
  console.log(`  Host: ${FM_HOST}`);
  console.log(`  DB:   ${FM_DATABASE}`);
  if (LIMIT) console.log(`  Limit: ${LIMIT} Bereiche`);
  if (SKIP_IMAGES) console.log(`  Images: skipped`);
  if (ONLY) console.log(`  Only phases: ${ONLY.join(",")}`);
  console.log("━".repeat(72));

  fmToken = await fmLogin();
  console.log("✓ FM Data API login OK");

  const pg = pgClient();
  await pg.connect();

  try {
    // Maps from FileMaker ID → Supabase UUID, for FK resolution
    const iconMap = new Map<string, string>();
    const bereichMap = new Map<string, string>();
    const kategorieMap = new Map<string, string>();
    const artikelMap = new Map<string, string>();

    // ─────────────────────────────────────────────────────────────
    // 1. Icons
    // ─────────────────────────────────────────────────────────────
    if (runPhase("icons")) {
      console.log("\n→ Icons");
      const rows = await fmFetchAll("API_Icons");
      console.log(`  ${rows.length} icons fetched`);
      for (const r of rows) {
        const fmId = r.ID_Icon;
        if (!fmId) continue;
        const label = (r.Icon_Name || "").toString().trim();
        if (!label) {
          report.icons.warnings.push(`Icon ${fmId} hat kein Label — skipped`);
          continue;
        }
        const symbolPath = await uploadContainer("assets", `icons/${fmId}`, r.Icon_Bild);
        if (!DRY_RUN) {
          const res = await pg.query(
            `insert into public.icons (external_id, label, symbol_path, sortierung, icon_kategorie, fm_erstellt_von, fm_geaendert_von)
             values ($1,$2,$3,$4,$5,$6,$7)
             on conflict (external_id) do update set
               label = excluded.label,
               symbol_path = coalesce(excluded.symbol_path, public.icons.symbol_path),
               sortierung = excluded.sortierung,
               icon_kategorie = excluded.icon_kategorie,
               fm_erstellt_von = excluded.fm_erstellt_von,
               fm_geaendert_von = excluded.fm_geaendert_von
             returning id, (xmax = 0) as inserted`,
            [fmId, label, symbolPath, toNum(r.Sortierung) ?? 0, r.Kategorie || null, r.ErstelltVon || null, r.GeändertVon || null],
          );
          iconMap.set(fmId, res.rows[0].id);
          if (res.rows[0].inserted) report.icons.inserted++; else report.icons.updated++;
        } else {
          report.icons.inserted++;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Farbfelder
    // ─────────────────────────────────────────────────────────────
    if (runPhase("farbfelder")) {
      console.log("\n→ Farbfelder");
      const rows = await fmFetchAll("API_Farbfelder");
      console.log(`  ${rows.length} farbfelder fetched`);
      for (const r of rows) {
        const fmId = r["Primärschlüssel"];
        if (!fmId) continue;
        const name = (r.Name || "").toString().trim();
        if (!name) continue;
        if (!DRY_RUN) {
          const res = await pg.query(
            `insert into public.farbfelder (external_id, name, code, rgb)
             values ($1,$2,$3,$4)
             on conflict (external_id) do update set
               name = excluded.name,
               code = excluded.code,
               rgb = excluded.rgb
             returning (xmax = 0) as inserted`,
            [fmId, name, r.Code || null, r.RGB || null],
          );
          if (res.rows[0].inserted) report.farbfelder.inserted++; else report.farbfelder.updated++;
        } else {
          report.farbfelder.inserted++;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Bereiche
    // ─────────────────────────────────────────────────────────────
    if (runPhase("bereiche")) {
      console.log("\n→ Bereiche");
      let rows = await fmFetchAll("API_Bereiche");
      console.log(`  ${rows.length} bereiche fetched`);
      if (LIMIT) rows = rows.slice(0, LIMIT);
      for (const r of rows) {
        const fmId = r.ID;
        if (!fmId) continue;
        const bildPath = await uploadContainer("produktbilder", `bereiche/${fmId}`, r.Bild);
        if (!DRY_RUN) {
          const res = await pg.query(
            `insert into public.bereiche
               (external_id, name, beschreibung, sortierung, seitenzahl, startseite, endseite, sortierung_alt, bild_path, fm_erstellt_von, fm_geaendert_von)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             on conflict (external_id) do update set
               name = excluded.name,
               beschreibung = excluded.beschreibung,
               sortierung = excluded.sortierung,
               seitenzahl = excluded.seitenzahl,
               startseite = excluded.startseite,
               endseite = excluded.endseite,
               sortierung_alt = excluded.sortierung_alt,
               bild_path = coalesce(excluded.bild_path, public.bereiche.bild_path),
               fm_erstellt_von = excluded.fm_erstellt_von,
               fm_geaendert_von = excluded.fm_geaendert_von
             returning id, (xmax = 0) as inserted`,
            [
              fmId,
              (r.Name || "").toString().trim() || "(ohne Name)",
              r.Beschreibung || null,
              toNum(r.Sortierung) ?? 0,
              toNum(r.Seitenzahl),
              toNum(r.Startseite),
              toNum(r.Endseite),
              toNum(r.Sortierung_alt),
              bildPath,
              r.ErstelltVon || null,
              r.GeändertVon || null,
            ],
          );
          bereichMap.set(fmId, res.rows[0].id);
          if (res.rows[0].inserted) report.bereiche.inserted++; else report.bereiche.updated++;
        } else {
          bereichMap.set(fmId, "dry-run-" + fmId);
          report.bereiche.inserted++;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Kategorien + kategorie_icons
    // ─────────────────────────────────────────────────────────────
    if (runPhase("kategorien")) {
      console.log("\n→ Kategorien");
      let rows = await fmFetchAll("API_Kategorien");
      console.log(`  ${rows.length} kategorien fetched`);
      if (LIMIT) {
        const allowed = new Set(bereichMap.keys());
        rows = rows.filter((r) => allowed.has(r.Bereich_ID));
      }
      for (const r of rows) {
        const fmId = r.ID;
        if (!fmId) continue;
        const bereichUuid = bereichMap.get(r.Bereich_ID);
        if (!bereichUuid) {
          report.kategorien.warnings.push(`Kategorie ${fmId} verweist auf fehlenden Bereich ${r.Bereich_ID}`);
          continue;
        }
        // Erstes verfügbares Bild als Vorschau
        const bildUrl = r.Bild1 || r.Bild2 || r.Bild3 || r.Bild4;
        const vorschauPath = bildUrl ? await uploadContainer("produktbilder", `kategorien/${fmId}`, bildUrl) : null;
        let katId: string;
        if (!DRY_RUN) {
          const res = await pg.query(
            `insert into public.kategorien
               (external_id, bereich_id, name, beschreibung, sortierung, vorschaubild_path,
                seitenangabe, seitenzahl, startseite, endseite, sortierung_alt, sortierung_ber,
                fm_erstellt_von, fm_geaendert_von)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             on conflict (external_id) do update set
               bereich_id = excluded.bereich_id,
               name = excluded.name,
               beschreibung = excluded.beschreibung,
               sortierung = excluded.sortierung,
               vorschaubild_path = coalesce(excluded.vorschaubild_path, public.kategorien.vorschaubild_path),
               seitenangabe = excluded.seitenangabe,
               seitenzahl = excluded.seitenzahl,
               startseite = excluded.startseite,
               endseite = excluded.endseite,
               sortierung_alt = excluded.sortierung_alt,
               sortierung_ber = excluded.sortierung_ber,
               fm_erstellt_von = excluded.fm_erstellt_von,
               fm_geaendert_von = excluded.fm_geaendert_von
             returning id, (xmax = 0) as inserted`,
            [
              fmId, bereichUuid,
              (r.Name || "").toString().trim() || "(ohne Name)",
              r.Beschreibung || null,
              toNum(r.Sortierung) ?? 0,
              vorschauPath,
              r.Seitenangabe || null,
              toNum(r.Seitenzahl), toNum(r.Startseite), toNum(r.Endseite),
              toNum(r.Sortierung_alt), toNum(r.Sortierung_ber),
              r.ErstelltVon || null, r.GeändertVon || null,
            ],
          );
          katId = res.rows[0].id;
          kategorieMap.set(fmId, katId);
          if (res.rows[0].inserted) report.kategorien.inserted++; else report.kategorien.updated++;
        } else {
          katId = "dry-run-" + fmId;
          kategorieMap.set(fmId, katId);
          report.kategorien.inserted++;
        }

        // kategorie_icons n:m
        if (!DRY_RUN) {
          await pg.query(`delete from public.kategorie_icons where kategorie_id = $1`, [katId]);
          for (let i = 1; i <= 10; i++) {
            const iconFmId = r[`Icon${i}_ID`];
            if (!iconFmId) continue;
            const iconUuid = iconMap.get(iconFmId);
            if (!iconUuid) {
              report.kategorie_icons.warnings.push(`Kategorie ${fmId}: Icon ${iconFmId} nicht gefunden`);
              continue;
            }
            await pg.query(
              `insert into public.kategorie_icons (kategorie_id, icon_id) values ($1,$2) on conflict do nothing`,
              [katId, iconUuid],
            );
            report.kategorie_icons.inserted++;
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Artikel (Produkte) + Icons + Galerie-Bilder
    // ─────────────────────────────────────────────────────────────
    if (runPhase("produkte") || runPhase("artikel")) {
      console.log("\n→ Artikel / Produkte");
      let rows = await fmFetchAll("API_Artikel");
      console.log(`  ${rows.length} artikel fetched`);
      if (LIMIT) {
        const allowed = new Set(kategorieMap.keys());
        rows = rows.filter((r) => allowed.has(r.Kategorie_ID));
      }
      let done = 0;
      for (const r of rows) {
        const fmId = r.ID;
        if (!fmId) continue;
        const katUuid = kategorieMap.get(r.Kategorie_ID);
        if (!katUuid) {
          report.produkte.warnings.push(`Artikel ${fmId} verweist auf fehlende Kategorie ${r.Kategorie_ID}`);
          continue;
        }
        // Bereich über Kategorie nachziehen
        const bereichUuid = !DRY_RUN
          ? (await pg.query(`select bereich_id from public.kategorien where id=$1`, [katUuid])).rows[0]?.bereich_id
          : "dry-run";
        if (!bereichUuid) continue;

        // Map Artikel-Felder -> Spalten
        const cols: string[] = [];
        const vals: any[] = [];
        cols.push("external_id"); vals.push(fmId);
        cols.push("artikelnummer"); vals.push((r.Name || fmId).toString().trim());
        cols.push("bereich_id"); vals.push(bereichUuid);
        cols.push("kategorie_id"); vals.push(katUuid);

        for (const [fmField, def] of Object.entries(ARTIKEL_MAP)) {
          let v: any = r[fmField];
          if (def.type === "num") v = toNum(v);
          else if (def.type === "int") { const n = toNum(v); v = n == null ? null : Math.round(n); }
          else if (def.type === "bool") v = toBool(v);
          else v = v == null || v === "" ? null : String(v);
          // NOT-NULL-Pflichtspalten: Fallback auf 0 falls leer
          if (v == null && (def.col === "sortierung")) v = 0;
          cols.push(def.col);
          vals.push(v);
        }

        // Hauptbild
        const hauptbildPath = await uploadContainer("produktbilder", `artikel/${fmId}/hauptbild`, r.Bild);
        cols.push("hauptbild_path"); vals.push(hauptbildPath);

        // Detail- und Zeichnungsbilder
        const detailPaths: Record<string, string | null> = {
          bild_detail_1_path: await uploadContainer("produktbilder", `artikel/${fmId}/detail1`, r.Bild_Detail_1),
          bild_detail_2_path: await uploadContainer("produktbilder", `artikel/${fmId}/detail2`, r.Bild_Detail_2),
          bild_zeichnung_1_path: await uploadContainer("produktbilder", `artikel/${fmId}/zeichnung1`, r.Bild_Zeichnung_1),
          bild_zeichnung_2_path: await uploadContainer("produktbilder", `artikel/${fmId}/zeichnung2`, r.Bild_Zeichnung_2),
          bild_zeichnung_3_path: await uploadContainer("produktbilder", `artikel/${fmId}/zeichnung3`, r.Bild_Zeichnung_3),
          bild_energielabel_path: await uploadContainer("produktbilder", `artikel/${fmId}/energielabel`, r.Bild_Energielabel),
        };
        for (const [k, v] of Object.entries(detailPaths)) { cols.push(k); vals.push(v); }

        let artikelUuid: string;
        if (!DRY_RUN) {
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
          const updateSet = cols
            .filter((c) => c !== "external_id" && !c.endsWith("_path"))
            .map((c) => `${c} = excluded.${c}`)
            .join(", ") + ", " + cols.filter((c) => c.endsWith("_path")).map((c) => `${c} = coalesce(excluded.${c}, public.produkte.${c})`).join(", ");
          const sql = `
            insert into public.produkte (${cols.join(",")})
            values (${placeholders})
            on conflict (external_id) do update set
              ${updateSet}
            returning id, (xmax = 0) as inserted
          `;
          const res = await pg.query(sql, vals);
          artikelUuid = res.rows[0].id;
          artikelMap.set(fmId, artikelUuid);
          if (res.rows[0].inserted) report.produkte.inserted++; else report.produkte.updated++;
        } else {
          artikelUuid = "dry-run-" + fmId;
          artikelMap.set(fmId, artikelUuid);
          report.produkte.inserted++;
        }

        // produkt_icons n:m (10 Slots)
        if (!DRY_RUN) {
          await pg.query(`delete from public.produkt_icons where produkt_id = $1`, [artikelUuid]);
          for (let i = 1; i <= 10; i++) {
            const iconFmId = r[`Icon${i}_ID`];
            if (!iconFmId) continue;
            const iconUuid = iconMap.get(iconFmId);
            if (!iconUuid) {
              report.produkt_icons.warnings.push(`Artikel ${fmId}: Icon ${iconFmId} nicht gefunden`);
              continue;
            }
            await pg.query(
              `insert into public.produkt_icons (produkt_id, icon_id, sortierung)
               values ($1,$2,$3) on conflict do nothing`,
              [artikelUuid, iconUuid, i],
            );
            report.produkt_icons.inserted++;
          }
        }

        done++;
        if (done % 25 === 0) console.log(`  ... ${done}/${rows.length}`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Preise
    // ─────────────────────────────────────────────────────────────
    if (runPhase("preise")) {
      console.log("\n→ Preise");
      let rows = await fmFetchAll("API_Preise");
      console.log(`  ${rows.length} preise fetched`);
      if (LIMIT) {
        const allowed = new Set(artikelMap.keys());
        rows = rows.filter((r) => allowed.has(r.Artikel_ID));
      }
      for (const r of rows) {
        const fmId = r.ID;
        const artikelUuid = artikelMap.get(r.Artikel_ID);
        if (!artikelUuid) {
          report.preise.warnings.push(`Preis ${fmId}: Artikel ${r.Artikel_ID} nicht gefunden`);
          continue;
        }
        const listen = toNum(r.Listenpreis) ?? 0;
        const ekLG = toNum(r.EK_Lichtengros);
        const ekEK = toNum(r.EK_Eisenkeil);
        const gueltig = toDate(r.Gueltigkeitsdatum) ?? new Date().toISOString().slice(0, 10);
        const status = (r.Status || "").toString().toLowerCase() === "aktiv" ? "aktiv" : "inaktiv";
        if (!DRY_RUN) {
          const res = await pg.query(
            `insert into public.preise
               (external_id, produkt_id, gueltig_ab, listenpreis, ek, ek_lichtengros, ek_eisenkeil, status,
                preis_berechnet, preisimport_ok, preisimport_ok_ts)
             values ($1,$2,$3,$4,$5,$6,$7,$8::preis_status,$9,$10,$11)
             on conflict (external_id) do update set
               produkt_id = excluded.produkt_id,
               gueltig_ab = excluded.gueltig_ab,
               listenpreis = excluded.listenpreis,
               ek = excluded.ek,
               ek_lichtengros = excluded.ek_lichtengros,
               ek_eisenkeil = excluded.ek_eisenkeil,
               status = excluded.status,
               preis_berechnet = excluded.preis_berechnet,
               preisimport_ok = excluded.preisimport_ok,
               preisimport_ok_ts = excluded.preisimport_ok_ts
             returning (xmax = 0) as inserted`,
            [fmId, artikelUuid, gueltig, listen, ekLG, ekLG, ekEK, status, toNum(r.Preis_berechnet), r["Preisimport ok"] || null, toTs(r["Preisimport ok Zeitstempel"])],
          );
          if (res.rows[0].inserted) report.preise.inserted++; else report.preise.updated++;
        } else {
          report.preise.inserted++;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Katalogseiten
    // ─────────────────────────────────────────────────────────────
    if (runPhase("katalogseiten")) {
      console.log("\n→ Katalogseiten");
      const rows = await fmFetchAll("API_Katalogseiten");
      console.log(`  ${rows.length} katalogseiten fetched`);
      for (const r of rows) {
        const fmId = r["Primärschlüssel"];
        if (!fmId) continue;
        if (!DRY_RUN) {
          const res = await pg.query(
            `insert into public.katalog_seiten (external_id, seite) values ($1,$2)
             on conflict (external_id) do update set seite = excluded.seite
             returning (xmax = 0) as inserted`,
            [fmId, toNum(r.Seite) ?? 0],
          );
          if (res.rows[0].inserted) report.katalog_seiten.inserted++; else report.katalog_seiten.updated++;
        } else {
          report.katalog_seiten.inserted++;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 8. System → katalog_einstellungen (Singleton)
    // ─────────────────────────────────────────────────────────────
    if (runPhase("system")) {
      console.log("\n→ System → Einstellungen");
      const rows = await fmFetchAll("API_System");
      if (rows.length > 0) {
        const s = rows[0];
        const paths = {
          logo_lichtengros_dunkel: await uploadContainer("assets", `system/logo_lg`, s.Logo_LG),
          logo_eisenkeil_dunkel: await uploadContainer("assets", `system/logo_ek`, s.Logo_EK),
          logo_lichtengros_hell: await uploadContainer("assets", `system/seite1_logo_lg_hell`, s["Seite 1 Logo_LG_hell"]),
          logo_eisenkeil_hell: await uploadContainer("assets", `system/seite1_logo_ek_hell`, s["Seite 1 Logo_EK_hell"]),
          cover_vorne_path: await uploadContainer("assets", `system/seite1_logo_lg`, s["Seite 1 Logo_LG"]),
          cover_hinten_path: await uploadContainer("assets", `system/seite1_logo_ek`, s["Seite 1 Logo_EK"]),
        };
        if (!DRY_RUN) {
          await pg.query(
            `update public.katalog_einstellungen set
               version = $1,
               seite1_titel = $2,
               seite1_fusstext = $3,
               seite1_preistext = $4,
               seite99_fusstext_lg = $5,
               seite99_fusstext_ek = $6,
               preisaufschlag = $7,
               preisaufschlag_pm = $8,
               waehrung = $9,
               filialen_italien = $10,
               filialen_oesterreich = $11,
               wechselkurs_eur_chf = $12,
               logo_lichtengros_dunkel = coalesce($13::text, logo_lichtengros_dunkel),
               logo_eisenkeil_dunkel = coalesce($14::text, logo_eisenkeil_dunkel),
               logo_lichtengros_hell = coalesce($15::text, logo_lichtengros_hell),
               logo_eisenkeil_hell = coalesce($16::text, logo_eisenkeil_hell),
               cover_vorne_path = coalesce($17::text, cover_vorne_path),
               cover_hinten_path = coalesce($18::text, cover_hinten_path)
             where id = 1`,
            [
              s.Version || null,
              s["Seite 1 Titel"] || null, s["Seite 1 Fusstext"] || null, s["Seite 1 Preistext"] || null,
              s["Seite 99 Fusstext_LG"] || null, s["Seite 99 Fusstext_EK"] || null,
              toNum(s.Preisaufschlag), s.Preisaufschlag_plus_minus || null,
              s["Währung"] || "EUR",
              s.Filialen_Italien || null, s["Filialen_Österreich"] || null,
              toNum(s.Urechnungskurs) ?? 1.0,
              paths.logo_lichtengros_dunkel, paths.logo_eisenkeil_dunkel,
              paths.logo_lichtengros_hell, paths.logo_eisenkeil_hell,
              paths.cover_vorne_path, paths.cover_hinten_path,
            ],
          );
          report.einstellungen.updated = 1;
        }
      }
    }
  } finally {
    await pg.end();
    if (fmToken) await fmLogout(fmToken);
  }

  // ─────────────────────────────────────────────────────────────
  // Report
  // ─────────────────────────────────────────────────────────────
  const outPath = `scripts/migrate-dataapi-report.json`;
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("\n━".repeat(72));
  console.log("MIGRATION REPORT");
  console.log("━".repeat(72));
  for (const [key, val] of Object.entries(report)) {
    if (typeof val === "object" && val && "inserted" in (val as any)) {
      const v = val as PhaseReport;
      console.log(`  ${key.padEnd(20)} inserted=${v.inserted}  updated=${v.updated}  warnings=${v.warnings.length}`);
      for (const w of v.warnings.slice(0, 5)) console.log(`    ⚠ ${w}`);
      if (v.warnings.length > 5) console.log(`    ... +${v.warnings.length - 5} more`);
    }
  }
  console.log(`  bilder               uploaded=${report.bilder.uploaded}  failed=${report.bilder.failed}  skipped=${report.bilder.skipped}`);
  console.log(`\n→ Full report: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
