/**
 * Migrates the FileMaker XML export into Supabase.
 *
 * Usage:
 *   npx tsx scripts/migrate-filemaker.ts [path/to/xml]
 *
 * Idempotent: re-running upserts via external_id (FileMaker UUID).
 * Reports written to scripts/migrate-report.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decode } from "iconv-lite";
import { XMLParser } from "fast-xml-parser";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const XML_PATH = process.argv[2] ?? "daten/Lichtengross Produktkatalog_fmp12.xml";

// ---------------------------------------------------------------------------
// Field mapping FileMaker -> Postgres column
// (only fields we want to migrate; everything else ignored)
// ---------------------------------------------------------------------------
const PRODUKT_FIELD_MAP: Record<string, { col: string; type: "num" | "text" | "bool" }> = {
  Name: { col: "name", type: "text" },
  Sortierung: { col: "sortierung", type: "num" },
  marker_erledigt: { col: "artikel_bearbeitet", type: "bool" },

  Da_Titel: { col: "datenblatt_titel", type: "text" },
  Da_Beschreibung_1: { col: "datenblatt_text", type: "text" },

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
  t_m_Länge: { col: "laenge_mm", type: "num" },
  t_m_Breite: { col: "breite_mm", type: "num" },
  t_m_Höhe: { col: "hoehe_mm", type: "num" },
  t_m_Außendurchmesser: { col: "aussendurchmesser_mm", type: "num" },
  t_m_Einbaudurchmesser: { col: "einbaudurchmesser_mm", type: "num" },
  t_m_Gewicht: { col: "gewicht_g", type: "num" },
  t_m_Gehäusefarbe: { col: "gehaeusefarbe", type: "text" },
  t_m_Montageart: { col: "montageart", type: "text" },
  t_m_Schlagfestigkeit: { col: "schlagfestigkeit", type: "text" },
  t_m_Schutzart_IP: { col: "schutzart_ip", type: "text" },
  t_m_Werkstoff_des_Gehäuses: { col: "werkstoff_gehaeuse", type: "text" },
  t_m_Leuchtmittel: { col: "leuchtmittel", type: "text" },
  t_m_Sockel: { col: "sockel", type: "text" },
  w_Rollenlänge: { col: "rollenlaenge_m", type: "num" },
  t_m_maximale_Länge: { col: "maximale_laenge_m", type: "num" },
  t_m_Anzahl_der_LED_pro_Meter: { col: "anzahl_led_pro_meter", type: "num" },
  t_m_Abstand_LED_zu_LED: { col: "abstand_led_zu_led_mm", type: "num" },
  "t_m_Länge_der_einzelnen_Abschnitte": { col: "laenge_abschnitte_mm", type: "num" },
  t_m_Kleinster_Biegeradius: { col: "kleinster_biegeradius_mm", type: "num" },

  // Thermisch
  t_t_Lebensdauer: { col: "lebensdauer_h", type: "num" },
  t_t_Umgebungstemperatur: { col: "temperatur_ta", type: "text" },

  // Sonstiges
  t_m_mit_Betriebsgerät: { col: "mit_betriebsgeraet", type: "bool" },
  t_s_Optional: { col: "optional_text", type: "text" },
  t_s_Zertifikate: { col: "zertifikate", type: "text" },
};

const PRODUKT_BINARY_FIELDS = ["Bild", "Bild_Detail_1", "Bild_Detail_2", "Bild_Zeichnung_1", "Bild_Zeichnung_2", "Bild_Zeichnung_3", "Bild_Energielabel"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pgClient() {
  const url = process.env.POSTGRES_URL_NON_POOLING!.replace(/[?&]sslmode=[^&]+/g, "");
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function fieldValue(field: any): string | null {
  if (field == null) return null;
  if (typeof field === "string") return field;
  if (typeof field === "number") return String(field);
  // FileMaker: <Field name="Foo"><Data>value</Data></Field>
  const data = field.Data;
  if (data == null) return null;
  if (typeof data === "string") return data;
  if (typeof data === "number") return String(data);
  if (data["#text"] != null) return String(data["#text"]);
  return null;
}

function recordFields(record: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of asArray(record.Field)) {
    const name = f["@_name"];
    if (name) out[name] = f;
  }
  return out;
}

function toNum(v: string | null): number | null {
  if (v == null || v === "") return null;
  const cleaned = v.replace(",", ".").replace(/[^0-9.\-eE]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: string | null): boolean | null {
  if (v == null || v === "") return null;
  const t = v.trim().toLowerCase();
  if (["1", "ja", "true", "yes", "y"].includes(t)) return true;
  if (["0", "nein", "false", "no", "n"].includes(t)) return false;
  return null;
}

function toDate(v: string | null): string | null {
  if (!v) return null;
  // FileMaker dates: "DD.MM.YYYY" or "MM/DD/YYYY"
  const m = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
type Report = {
  bereiche: { inserted: number; updated: number; warnings: string[] };
  kategorien: { inserted: number; updated: number; warnings: string[] };
  produkte: { inserted: number; updated: number; warnings: string[] };
  preise: { inserted: number; updated: number; warnings: string[] };
  filialen: { inserted: number; updated: number; warnings: string[] };
  einstellungen: { updated: boolean };
  bilder: { uploaded: number; failed: number };
};

const report: Report = {
  bereiche: { inserted: 0, updated: 0, warnings: [] },
  kategorien: { inserted: 0, updated: 0, warnings: [] },
  produkte: { inserted: 0, updated: 0, warnings: [] },
  preise: { inserted: 0, updated: 0, warnings: [] },
  filialen: { inserted: 0, updated: 0, warnings: [] },
  einstellungen: { updated: false },
  bilder: { uploaded: 0, failed: 0 },
};

async function main() {
  console.log(`Reading ${XML_PATH}…`);
  const raw = readFileSync(XML_PATH);
  const text = decode(raw, "utf16-le").replace(/^\uFEFF/, "");

  console.log(`Parsing ${(text.length / 1024 / 1024).toFixed(1)} MB XML…`);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    parseAttributeValue: false,
    htmlEntities: false,
    processEntities: false,
  });
  const doc = parser.parse(text);
  const file = doc?.FMPReport?.File;

  // Build lookup: BaseTable name -> ResultSet (records)
  const resultSets = asArray(file.ResultSet);
  const recordsByTable: Record<string, any[]> = {};
  for (const rs of resultSets) {
    const name = rs["@_table"] ?? rs["@_name"];
    recordsByTable[name] = asArray(rs.Row);
  }

  console.log("Tables in XML:", Object.entries(recordsByTable).map(([k, v]) => `${k}=${v.length}`).join(", "));

  const pg = pgClient();
  await pg.connect();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // -------------------------------------------------------------------------
  // Helper: extract & upload image, return storage path
  // -------------------------------------------------------------------------
  async function uploadBinary(bucket: string, path: string, base64: string): Promise<string | null> {
    try {
      const bytes = Buffer.from(base64, "base64");
      // Detect mime
      let ext = "bin";
      let contentType = "application/octet-stream";
      if (bytes[0] === 0xff && bytes[1] === 0xd8) { ext = "jpg"; contentType = "image/jpeg"; }
      else if (bytes[0] === 0x89 && bytes[1] === 0x50) { ext = "png"; contentType = "image/png"; }
      else if (bytes[0] === 0x47 && bytes[1] === 0x49) { ext = "gif"; contentType = "image/gif"; }

      const fullPath = `${path}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(fullPath, bytes, {
        contentType,
        upsert: true,
      });
      if (error) {
        report.bilder.failed += 1;
        console.warn(`  upload failed ${fullPath}: ${error.message}`);
        return null;
      }
      report.bilder.uploaded += 1;
      return fullPath;
    } catch (e: any) {
      report.bilder.failed += 1;
      console.warn(`  upload exception ${path}: ${e.message}`);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // 1) Bereiche
  // -------------------------------------------------------------------------
  console.log("\n--- Bereiche ---");
  const bereichExtToUuid = new Map<string, string>();
  for (const row of recordsByTable["Bereiche"] ?? []) {
    const f = recordFields(row);
    const ext = fieldValue(f.ID);
    if (!ext) continue;

    const name = fieldValue(f.Name) ?? "(unbenannt)";
    const beschreibung = fieldValue(f.Beschreibung);
    const sortierung = toNum(fieldValue(f.Sortierung)) ?? 0;
    const seitenzahl = toNum(fieldValue(f.Seitenzahl));
    const startseite = toNum(fieldValue(f.Startseite));

    let bildPath: string | null = null;
    const bildBase64 = fieldValue(f.Bild);
    if (bildBase64 && bildBase64.length > 100) {
      bildPath = await uploadBinary("produktbilder", `bereiche/${ext}`, bildBase64);
    }

    const result = await pg.query(
      `insert into bereiche (external_id, name, beschreibung, sortierung, seitenzahl, startseite, bild_path)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (external_id) do update set
         name=excluded.name, beschreibung=excluded.beschreibung,
         sortierung=excluded.sortierung, seitenzahl=excluded.seitenzahl,
         startseite=excluded.startseite,
         bild_path=coalesce(excluded.bild_path, bereiche.bild_path)
       returning id, (xmax = 0) as inserted`,
      [ext, name, beschreibung, sortierung, seitenzahl, startseite, bildPath],
    );
    const { id, inserted } = result.rows[0];
    bereichExtToUuid.set(ext, id);
    if (inserted) report.bereiche.inserted += 1; else report.bereiche.updated += 1;
  }
  console.log(`  ${report.bereiche.inserted} inserted, ${report.bereiche.updated} updated`);

  // -------------------------------------------------------------------------
  // 2) Kategorien (+ icons collected on the fly)
  // -------------------------------------------------------------------------
  console.log("\n--- Kategorien ---");
  const kategorieExtToUuid = new Map<string, string>();
  const iconLabelToUuid = new Map<string, string>();

  async function getOrCreateIcon(label: string): Promise<string> {
    const cached = iconLabelToUuid.get(label);
    if (cached) return cached;
    const r = await pg.query(
      `insert into icons (label, sortierung) values ($1, 0)
       on conflict (label) do update set label=excluded.label
       returning id`,
      [label],
    );
    iconLabelToUuid.set(label, r.rows[0].id);
    return r.rows[0].id;
  }

  for (const row of recordsByTable["Kategorien"] ?? []) {
    const f = recordFields(row);
    const ext = fieldValue(f.ID);
    if (!ext) continue;
    const bereichExt = fieldValue(f.Bereich_ID);
    const bereichUuid = bereichExt ? bereichExtToUuid.get(bereichExt) : null;
    if (!bereichUuid) {
      report.kategorien.warnings.push(`Kategorie ${ext}: Bereich_ID ${bereichExt} nicht gefunden`);
      continue;
    }
    const name = fieldValue(f.Name) ?? "(unbenannt)";
    const beschreibung = fieldValue(f.Beschreibung);
    const sortierung = toNum(fieldValue(f.Sortierung)) ?? 0;

    let bildPath: string | null = null;
    const bildBase64 = fieldValue(f.Bild1);
    if (bildBase64 && bildBase64.length > 100) {
      bildPath = await uploadBinary("produktbilder", `kategorien/${ext}`, bildBase64);
    }

    const r = await pg.query(
      `insert into kategorien (external_id, bereich_id, name, beschreibung, sortierung, vorschaubild_path)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (external_id) do update set
         bereich_id=excluded.bereich_id, name=excluded.name,
         beschreibung=excluded.beschreibung, sortierung=excluded.sortierung,
         vorschaubild_path=coalesce(excluded.vorschaubild_path, kategorien.vorschaubild_path)
       returning id, (xmax = 0) as inserted`,
      [ext, bereichUuid, name, beschreibung, sortierung, bildPath],
    );
    const { id, inserted } = r.rows[0];
    kategorieExtToUuid.set(ext, id);
    if (inserted) report.kategorien.inserted += 1; else report.kategorien.updated += 1;

    // Icons (Icon_Wert_1 .. Icon_Wert_10)
    const iconLabels = new Set<string>();
    for (let i = 1; i <= 10; i++) {
      const val = fieldValue(f[`Icon_Wert_${i}`]);
      if (val && val.trim()) iconLabels.add(val.trim());
    }
    if (iconLabels.size > 0) {
      await pg.query(`delete from kategorie_icons where kategorie_id=$1`, [id]);
      for (const lbl of iconLabels) {
        const iconId = await getOrCreateIcon(lbl);
        await pg.query(
          `insert into kategorie_icons (kategorie_id, icon_id) values ($1,$2)
           on conflict do nothing`, [id, iconId]);
      }
    }
  }
  console.log(`  ${report.kategorien.inserted} inserted, ${report.kategorien.updated} updated, ${iconLabelToUuid.size} icons`);

  // -------------------------------------------------------------------------
  // 3) Artikel / Produkte
  // -------------------------------------------------------------------------
  console.log("\n--- Produkte ---");
  const produktExtToUuid = new Map<string, string>();

  for (const row of recordsByTable["Artikel"] ?? []) {
    const f = recordFields(row);
    const ext = fieldValue(f.ID);
    if (!ext) continue;
    const kategorieExt = fieldValue(f.Kategorie_ID);
    const kategorieUuid = kategorieExt ? kategorieExtToUuid.get(kategorieExt) : null;
    if (!kategorieUuid) {
      report.produkte.warnings.push(`Produkt ${ext}: Kategorie_ID ${kategorieExt} fehlt`);
      continue;
    }
    // We need bereich_id too — derive from kategorie
    const ber = await pg.query(`select bereich_id from kategorien where id=$1`, [kategorieUuid]);
    const bereichUuid = ber.rows[0]?.bereich_id;
    if (!bereichUuid) {
      report.produkte.warnings.push(`Produkt ${ext}: Bereich für Kategorie ${kategorieUuid} fehlt`);
      continue;
    }

    const artikelnummer = fieldValue(f.Name) ?? `MIGRATED-${ext}`;

    const cols: string[] = [];
    const placeholders: string[] = [];
    const values: any[] = [];

    function add(col: string, val: any) {
      cols.push(col);
      placeholders.push(`$${values.length + 1}`);
      values.push(val);
    }

    add("external_id", ext);
    add("artikelnummer", artikelnummer);
    add("bereich_id", bereichUuid);
    add("kategorie_id", kategorieUuid);

    for (const [fmName, m] of Object.entries(PRODUKT_FIELD_MAP)) {
      const raw = fieldValue(f[fmName]);
      let v: any;
      if (m.type === "num") v = toNum(raw);
      else if (m.type === "bool") v = toBool(raw);
      else v = raw;
      add(m.col, v);
    }

    // Hauptbild
    const bildBase64 = fieldValue(f.Bild);
    let hauptbildPath: string | null = null;
    if (bildBase64 && bildBase64.length > 100) {
      hauptbildPath = await uploadBinary("produktbilder", `produkte/${ext}/hauptbild`, bildBase64);
    }
    add("hauptbild_path", hauptbildPath);

    const updateSet = cols
      .filter((c) => c !== "external_id")
      .map((c) => `${c}=excluded.${c}`)
      .join(", ");

    const r = await pg.query(
      `insert into produkte (${cols.join(",")}) values (${placeholders.join(",")})
       on conflict (external_id) do update set ${updateSet}
       returning id, (xmax = 0) as inserted`,
      values,
    );
    const { id, inserted } = r.rows[0];
    produktExtToUuid.set(ext, id);
    if (inserted) report.produkte.inserted += 1; else report.produkte.updated += 1;

    // Galerie-Bilder (Bild_Detail_1, _2, Bild_Zeichnung_1, _2, _3)
    const galleryFields = ["Bild_Detail_1", "Bild_Detail_2", "Bild_Zeichnung_1", "Bild_Zeichnung_2", "Bild_Zeichnung_3"];
    let order = 0;
    await pg.query(`delete from produkt_bilder where produkt_id=$1`, [id]);
    for (const gf of galleryFields) {
      const b64 = fieldValue(f[gf]);
      if (!b64 || b64.length < 100) continue;
      const path = await uploadBinary("produktbilder", `produkte/${ext}/${gf}`, b64);
      if (path) {
        await pg.query(
          `insert into produkt_bilder (produkt_id, storage_path, sortierung, alt_text)
           values ($1,$2,$3,$4)`, [id, path, order++, gf]);
      }
    }

    // Produkt-Icons (Icon_Wert_1 .. _10)
    await pg.query(`delete from produkt_icons where produkt_id=$1`, [id]);
    let isort = 0;
    for (let i = 1; i <= 10; i++) {
      const val = fieldValue(f[`Icon_Wert_${i}`]);
      if (val && val.trim()) {
        const iconId = await getOrCreateIcon(val.trim());
        await pg.query(
          `insert into produkt_icons (produkt_id, icon_id, sortierung)
           values ($1,$2,$3) on conflict do nothing`, [id, iconId, isort++]);
      }
    }

    if (report.produkte.inserted % 50 === 0 || report.produkte.updated % 50 === 0) {
      process.stdout.write(`  …${report.produkte.inserted + report.produkte.updated}\n`);
    }
  }
  console.log(`  ${report.produkte.inserted} inserted, ${report.produkte.updated} updated`);

  // -------------------------------------------------------------------------
  // 4) Preise
  // -------------------------------------------------------------------------
  console.log("\n--- Preise ---");
  for (const row of recordsByTable["Preise"] ?? []) {
    const f = recordFields(row);
    const ext = fieldValue(f.ID);
    if (!ext) continue;
    const artExt = fieldValue(f.Artikel_ID);
    const produktUuid = artExt ? produktExtToUuid.get(artExt) : null;
    if (!produktUuid) {
      report.preise.warnings.push(`Preis ${ext}: Artikel_ID ${artExt} fehlt`);
      continue;
    }
    const lp = toNum(fieldValue(f.Listenpreis));
    if (lp == null) continue;
    const ek = toNum(fieldValue(f.EK_Lichtengros)) ?? toNum(fieldValue(f.EK_Eisenkeil));
    const gueltigAb = toDate(fieldValue(f.Gueltigkeitsdatum)) ?? new Date().toISOString().slice(0, 10);
    const status = (fieldValue(f.Status) ?? "aktiv").toLowerCase().includes("inaktiv") ? "inaktiv" : "aktiv";

    // Skip duplicates by combining produkt_id + gueltig_ab + listenpreis
    const dup = await pg.query(
      `select id from preise where produkt_id=$1 and gueltig_ab=$2 and listenpreis=$3 limit 1`,
      [produktUuid, gueltigAb, lp],
    );
    if (dup.rows.length > 0) continue;

    await pg.query(
      `insert into preise (produkt_id, gueltig_ab, ek, listenpreis, status)
       values ($1,$2,$3,$4,$5::preis_status)`,
      [produktUuid, gueltigAb, ek, lp, status],
    );
    report.preise.inserted += 1;
  }
  console.log(`  ${report.preise.inserted} inserted`);

  // -------------------------------------------------------------------------
  // 5) Filialen (aus System-Tabelle: Filialen_Italien, Filialen_Österreich)
  // -------------------------------------------------------------------------
  console.log("\n--- Filialen & Einstellungen ---");
  const sysRow = (recordsByTable["System"] ?? [])[0];
  if (sysRow) {
    const sf = recordFields(sysRow);
    // Filialen-Texte sind Mehrzeilenblöcke — wir speichern sie als kombinierte Filialen-Einträge
    const it = fieldValue(sf.Filialen_Italien);
    const at = fieldValue(sf.Filialen_Österreich);
    let order = 0;
    for (const [land, blob] of [["IT", it], ["AT", at]] as const) {
      if (!blob) continue;
      // Aufteilen an Doppelleerzeilen — pragmatisch
      const blocks = blob.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
      for (const block of blocks) {
        const ext = `sys-${land}-${order}`;
        const lines = block.split("\n");
        const name = lines[0] ?? "Filiale";
        await pg.query(
          `insert into filialen (external_id, marke, name, land, adresse, sortierung)
           values ($1, 'lichtengros', $2, $3, $4, $5)
           on conflict (external_id) do update set
             name=excluded.name, adresse=excluded.adresse, sortierung=excluded.sortierung`,
          [ext, name, land, block, order],
        );
        order++;
        report.filialen.inserted += 1;
      }
    }

    // Katalog-Einstellungen (Singleton)
    const copyLG = fieldValue(sf["Seite 99 Fusstext_LG"]);
    const copyEK = fieldValue(sf["Seite 99 Fusstext_EK"]);
    const wechselkurs = toNum(fieldValue(sf.Urechnungskurs));

    // Logos
    async function maybeUploadLogo(bucket: string, fmField: string, name: string) {
      const b64 = fieldValue(sf[fmField]);
      if (!b64 || b64.length < 100) return null;
      return uploadBinary(bucket, `logos/${name}`, b64);
    }
    const logoLG = await maybeUploadLogo("assets", "Logo_LG", "lichtengros");
    const logoEK = await maybeUploadLogo("assets", "Logo_EK", "eisenkeil");
    const logoLGhell = await maybeUploadLogo("assets", "Seite 1 Logo_LG_hell", "lichtengros-hell");
    const logoEKhell = await maybeUploadLogo("assets", "Seite 1 Logo_EK_hell", "eisenkeil-hell");

    await pg.query(
      `update katalog_einstellungen set
         copyright_lichtengros=$1, copyright_eisenkeil=$2,
         wechselkurs_eur_chf=coalesce($3, wechselkurs_eur_chf),
         logo_lichtengros_dunkel=coalesce($4, logo_lichtengros_dunkel),
         logo_eisenkeil_dunkel=coalesce($5, logo_eisenkeil_dunkel),
         logo_lichtengros_hell=coalesce($6, logo_lichtengros_hell),
         logo_eisenkeil_hell=coalesce($7, logo_eisenkeil_hell)
       where id=1`,
      [copyLG, copyEK, wechselkurs, logoLG, logoEK, logoLGhell, logoEKhell],
    );
    report.einstellungen.updated = true;
  }
  console.log(`  ${report.filialen.inserted} Filialen, Einstellungen aktualisiert: ${report.einstellungen.updated}`);

  await pg.end();

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------
  writeFileSync("scripts/migrate-report.json", JSON.stringify(report, null, 2));
  console.log("\n=== Report ===");
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReport written to scripts/migrate-report.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
