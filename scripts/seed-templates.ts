/**
 * Seeds 3 system datenblatt templates matching the FileMaker layouts.
 */
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

type Slot = {
  id: string; label: string;
  x_cm: number; y_cm: number;
  width_cm: number; height_cm: number;
  kind: "image" | "energielabel" | "cutting";
};

// A4 usable area: 21 x 29.7 cm. We leave ~1cm margins, so content area starts at x=1, y=1.
// Layouts approximated from the screenshots.

const V1_SLOTS: Slot[] = [
  { id: "hauptbild",  label: "Hauptbild",         x_cm: 1,  y_cm: 1,    width_cm: 11, height_cm: 6.5, kind: "image" },
  { id: "cutting",    label: "Cutting-Diagramm",  x_cm: 1,  y_cm: 8,    width_cm: 11, height_cm: 2.2, kind: "cutting" },
  { id: "detail_1",   label: "Detailbild 1",      x_cm: 1,  y_cm: 11,   width_cm: 6,  height_cm: 6,   kind: "image" },
  { id: "detail_2",   label: "Detailbild 2",      x_cm: 7.5,y_cm: 11,   width_cm: 6,  height_cm: 6,   kind: "image" },
  { id: "detail_3",   label: "Detailbild 3",      x_cm: 14, y_cm: 11,   width_cm: 6,  height_cm: 6,   kind: "image" },
  { id: "energielabel", label: "Energielabel",    x_cm: 18, y_cm: 1,    width_cm: 1.5, height_cm: 3,  kind: "energielabel" },
];

const V2_SLOTS: Slot[] = [
  { id: "hauptbild",  label: "Hauptbild",         x_cm: 1,  y_cm: 1,    width_cm: 11, height_cm: 9,   kind: "image" },
  { id: "detail_1",   label: "Detailbild 1",      x_cm: 1,  y_cm: 10.5, width_cm: 6,  height_cm: 4.4, kind: "image" },
  { id: "detail_2",   label: "Detailbild 2",      x_cm: 7.5,y_cm: 10.5, width_cm: 6,  height_cm: 4.4, kind: "image" },
  { id: "detail_3",   label: "Detailbild 3",      x_cm: 14, y_cm: 10.5, width_cm: 6,  height_cm: 4.4, kind: "image" },
  { id: "cutting",    label: "Cutting-Diagramm",  x_cm: 1,  y_cm: 16,   width_cm: 20, height_cm: 2.3, kind: "cutting" },
  { id: "energielabel", label: "Energielabel",    x_cm: 18, y_cm: 1,    width_cm: 1.5, height_cm: 3,  kind: "energielabel" },
];

const V3_SLOTS: Slot[] = [
  { id: "hauptbild",  label: "Hauptbild",         x_cm: 1,  y_cm: 1,    width_cm: 11, height_cm: 9,   kind: "image" },
  { id: "detail_1",   label: "Detailbild 1",      x_cm: 1,  y_cm: 10.5, width_cm: 6,  height_cm: 4.4, kind: "image" },
  { id: "detail_2",   label: "Detailbild 2",      x_cm: 7.5,y_cm: 10.5, width_cm: 6,  height_cm: 4.4, kind: "image" },
  { id: "detail_3",   label: "Detailbild 3",      x_cm: 14, y_cm: 10.5, width_cm: 6,  height_cm: 4.4, kind: "image" },
  { id: "cutting",    label: "Cutting-Diagramm",  x_cm: 1,  y_cm: 16,   width_cm: 10, height_cm: 2.3, kind: "cutting" },
  { id: "effizienz",  label: "Effizienzgrafik",   x_cm: 12, y_cm: 16,   width_cm: 10, height_cm: 2.3, kind: "image" },
  { id: "energielabel", label: "Energielabel",    x_cm: 18, y_cm: 1,    width_cm: 1.5, height_cm: 3,  kind: "energielabel" },
];

async function main() {
  const url = process.env.POSTGRES_URL_NON_POOLING!.replace(/[?&]sslmode=[^&]+/g, "");
  const pg = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pg.connect();

  const templates = [
    { name: "Version 1 — Hauptbild + Cutting + 3 Details", slots: V1_SLOTS, sortierung: 1 },
    { name: "Version 2 — Großes Hauptbild + 3 Details + breites Cutting", slots: V2_SLOTS, sortierung: 2 },
    { name: "Version 3 — Hauptbild + 3 Details + Cutting + Effizienz", slots: V3_SLOTS, sortierung: 3 },
  ];

  for (const t of templates) {
    // Upsert by name for system templates
    const existing = await pg.query(`SELECT id FROM datenblatt_templates WHERE name=$1 AND is_system=true`, [t.name]);
    if (existing.rows.length > 0) {
      await pg.query(
        `UPDATE datenblatt_templates SET slots=$1::jsonb, sortierung=$2 WHERE id=$3`,
        [JSON.stringify(t.slots), t.sortierung, existing.rows[0].id],
      );
    } else {
      await pg.query(
        `INSERT INTO datenblatt_templates (name, slots, is_system, sortierung)
         VALUES ($1, $2::jsonb, true, $3)`,
        [t.name, JSON.stringify(t.slots), t.sortierung],
      );
    }
    console.log(`✓ ${t.name} (${t.slots.length} Slots)`);
  }

  await pg.end();
  console.log("\nSystem templates seeded.");
}

main().catch((e) => { console.error(e); process.exit(1); });
