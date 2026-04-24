/**
 * Lädt die 5 EMF-Kategorie-Bilder aus FileMaker, konvertiert sie mit Inkscape zu PNG,
 * lädt sie nach Supabase hoch und setzt bildN_path.
 *
 * Die 5 Bilder:
 *   - Tina                      → Bild3 (EMF)
 *   - Dim to Warm               → Bild1 (EMF)
 *   - Side.                     → Bild4 (EMF)
 *   - Downlight Ausschnitt 68mm → Bild3 (EMF)
 *   - Spike+Sun                 → Bild3 (EMF)
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

config({ path: ".env.local" });

const FM_HOST = process.env.FM_HOST!;
const FM_DATABASE = process.env.FM_DATABASE!;
const FM_USERNAME = process.env.FM_USERNAME!;
const FM_PASSWORD = process.env.FM_PASSWORD!;
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
  return json.response.token;
}

async function fmLogout(token: string) {
  await fetch(`${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/sessions/${token}`, { method: "DELETE" });
}

async function fmDownloadContainer(url: string): Promise<Buffer | null> {
  const first = await fetch(url, { redirect: "manual", headers: { Authorization: `Bearer ${fmToken}` } });
  if (first.ok) return Buffer.from(await first.arrayBuffer());
  if (first.status === 302 || first.status === 301) {
    const loc = first.headers.get("location")!;
    const cookie = first.headers.get("set-cookie");
    const nextUrl = loc.startsWith("http") ? loc : new URL(loc, url).toString();
    const headers: Record<string, string> = {};
    if (cookie) headers["Cookie"] = cookie.split(";")[0];
    const second = await fetch(nextUrl, { headers, redirect: "follow" });
    if (!second.ok) return null;
    return Buffer.from(await second.arrayBuffer());
  }
  return null;
}

/** EMF/WMF → PNG mit Inkscape CLI. Rendert Vektor auf ~800px Breite (gute Qualität für 15x3cm Druck). */
function emfToPng(emfBytes: Buffer): Buffer | null {
  const dir = mkdtempSync(join(tmpdir(), "emf2png-"));
  const inPath = join(dir, "in.emf");
  const outPath = join(dir, "out.png");
  try {
    writeFileSync(inPath, emfBytes);
    execSync(
      `inkscape "${inPath}" --export-type=png --export-filename="${outPath}" --export-width=800`,
      { stdio: "pipe" },
    );
    return readFileSync(outPath);
  } catch (e: any) {
    console.warn(`  inkscape failed: ${e.message}`);
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  fmToken = await fmLogin();
  console.log("✓ FM login");

  // Hole FM-Kategorien mit ihren Bild-URLs
  const res = await fetch(
    `${FM_HOST}/fmi/data/vLatest/databases/${DB_ENC}/layouts/API_Kategorien/records?_limit=1000`,
    { headers: { Authorization: `Bearer ${fmToken}` } },
  );
  const fmRecords = (await res.json()).response.data;
  const fmById = new Map<string, any>();
  for (const r of fmRecords) fmById.set(r.fieldData.ID, r.fieldData);

  // Hole die betroffenen Kategorien aus Supabase (mit NULL bild-slots)
  const { data: dbKategorien } = await supabase
    .from("kategorien")
    .select("id, external_id, name, bild1_path, bild2_path, bild3_path, bild4_path");

  const fixes: { name: string; katId: string; extId: string; slots: number[] }[] = [];
  for (const k of dbKategorien!) {
    const fm = fmById.get(k.external_id);
    if (!fm) continue;
    const missing: number[] = [];
    for (let i = 1; i <= 4; i++) {
      const fmUrl = fm[`Bild${i}`];
      const dbPath = (k as any)[`bild${i}_path`];
      if (fmUrl && !dbPath) missing.push(i);
    }
    if (missing.length) fixes.push({ name: k.name, katId: k.id, extId: k.external_id, slots: missing });
  }

  console.log(`\n${fixes.length} Kategorien mit fehlenden Bildern:`);
  for (const f of fixes) console.log(`  ${f.name.padEnd(35)} slots=${f.slots.join(",")}`);

  let ok = 0;
  let fail = 0;

  for (const fix of fixes) {
    const fm = fmById.get(fix.extId);
    for (const slot of fix.slots) {
      const fmUrl = fm[`Bild${slot}`];
      console.log(`\n→ ${fix.name} / Bild${slot}`);
      console.log(`  download EMF from FM...`);
      const emf = await fmDownloadContainer(fmUrl);
      if (!emf) { console.log("  ✗ download failed"); fail++; continue; }
      console.log(`  EMF size: ${emf.length}B, converting...`);
      const png = emfToPng(emf);
      if (!png) { fail++; continue; }
      console.log(`  ✓ PNG size: ${png.length}B`);

      const hash = createHash("sha256").update(png).digest("hex").slice(0, 16);
      const path = `kategorien/${fix.extId}-bild${slot}-${hash}.png`;
      const { error: upErr } = await supabase.storage.from("produktbilder").upload(path, png, {
        contentType: "image/png",
        upsert: true,
      });
      if (upErr) { console.log(`  ✗ upload failed: ${upErr.message}`); fail++; continue; }

      const { error: updErr } = await supabase
        .from("kategorien")
        .update({ [`bild${slot}_path`]: path })
        .eq("id", fix.katId);
      if (updErr) { console.log(`  ✗ DB update failed: ${updErr.message}`); fail++; continue; }
      console.log(`  ✓ gespeichert: ${path}`);
      ok++;
    }
  }

  console.log(`\n━━━ Ergebnis: ${ok} Bilder ergänzt, ${fail} Fehler ━━━`);
  await fmLogout(fmToken);
}

main().catch((e) => { console.error(e); process.exit(1); });
