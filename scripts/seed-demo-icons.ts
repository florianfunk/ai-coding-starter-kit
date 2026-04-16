/**
 * Seeds 4 dummy SVG icons with images into Supabase Storage + icons table.
 * Also groups existing text-label icons from previous seeding.
 */
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const SVG_ICONS: Array<{ label: string; gruppe: string; sortierung: number; bg: string; fg: string; content: string }> = [
  {
    label: "2700K", gruppe: "Lichtfarbe", sortierung: 1, bg: "#FFD54F", fg: "#000",
    content: `<text x="120" y="145" font-family="Arial Black, Arial, sans-serif" font-size="64" font-weight="900" text-anchor="middle" fill="#000">2700K</text>`,
  },
  {
    label: "3000K", gruppe: "Lichtfarbe", sortierung: 2, bg: "#FFE082", fg: "#000",
    content: `<text x="120" y="145" font-family="Arial Black, Arial, sans-serif" font-size="64" font-weight="900" text-anchor="middle" fill="#000">3000K</text>`,
  },
  {
    label: "IP20", gruppe: "Schutzart", sortierung: 10, bg: "#FFF", fg: "#000",
    content: `<text x="120" y="145" font-family="Arial Black, Arial, sans-serif" font-size="58" font-weight="900" text-anchor="middle" fill="#000">IP20</text>`,
  },
  {
    label: "CE", gruppe: "Zertifikate", sortierung: 20, bg: "#FFF", fg: "#000",
    content: `<text x="120" y="160" font-family="Arial Black, Arial, sans-serif" font-size="100" font-weight="900" text-anchor="middle" fill="#000">CE</text>`,
  },
];

function buildSvg(bg: string, inner: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <rect x="8" y="8" width="224" height="224" rx="24" ry="24" fill="${bg}" stroke="#222" stroke-width="6"/>
  ${inner}
</svg>`;
}

async function main() {
  const url = process.env.POSTGRES_URL_NON_POOLING!.replace(/[?&]sslmode=[^&]+/g, "");
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  for (const def of SVG_ICONS) {
    const svg = buildSvg(def.bg, def.content);
    const bytes = Buffer.from(svg, "utf-8");
    const path = `icons/demo-${def.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}.svg`;

    const { error: upErr } = await supabase.storage.from("produktbilder").upload(path, bytes, {
      contentType: "image/svg+xml",
      upsert: true,
    });
    if (upErr) { console.error(`✗ upload ${def.label}: ${upErr.message}`); continue; }

    // Upsert icon row (label, gruppe unique-ish — delete + insert simple here)
    await pg.query(`DELETE FROM icons WHERE label=$1`, [def.label]);
    await pg.query(
      `INSERT INTO icons (label, gruppe, sortierung, symbol_path) VALUES ($1,$2,$3,$4)`,
      [def.label, def.gruppe, def.sortierung, path],
    );
    console.log(`✓ ${def.label} (${def.gruppe})`);
  }

  // Group existing plain-text icons from earlier seeding
  const seeds: Array<[string, string]> = [
    ["4000K", "Lichtfarbe"], ["IP65", "Schutzart"], ["IP67", "Schutzart"],
    ["RoHS", "Zertifikate"], ["Dimmable", "Sonstiges"], ["SMD/mt", "Sonstiges"], ["LM80", "Sonstiges"],
  ];
  for (const [label, gruppe] of seeds) {
    await pg.query(`UPDATE icons SET gruppe=$1 WHERE label=$2 AND gruppe IS NULL`, [gruppe, label]);
  }

  await pg.end();
  console.log("\nDemo icons seeded.");
}

main().catch((e) => { console.error(e); process.exit(1); });
