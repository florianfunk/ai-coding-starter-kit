/**
 * Setzt `icons.gruppe` anhand der Label-Zuordnung.
 * Einmaliger Lauf — idempotent.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const GROUPS: Record<string, string[]> = {
  Lichtfarbe: ["2000K", "2700K", "3000K", "4000K", "blau", "RGB", "Dim to warm"],
  Lichttechnik: ["Lumen", "Lumen/mt", "CRI", "Abstrahlwinkel", "COB", "LM80"],
  Elektrisch: ["Volt", "Watt", "mA", "Schutzklasse", "Schutzisolierung", "Erdung", "Dimmbar"],
  Schutzart: ["IP20", "IP44", "IP54", "IP65", "IP67"],
  Mechanisch: ["Cutout", "Cutting", "Einbautiefe", "SMD/mt"],
  Einsatzort: ["Innenräumen"],
  Zertifikate: ["CE", "RoHS", "SAA"],
};

async function main() {
  config({ path: ".env.local" });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Label -> Gruppe umkehren
  const labelToGroup = new Map<string, string>();
  for (const [group, labels] of Object.entries(GROUPS)) {
    for (const l of labels) labelToGroup.set(l.toLowerCase(), group);
  }

  const { data: icons, error } = await supabase.from("icons").select("id, label");
  if (error) throw error;

  let matched = 0;
  let unmatched: string[] = [];

  for (const ic of icons!) {
    const group = labelToGroup.get(ic.label.toLowerCase());
    if (!group) {
      unmatched.push(ic.label);
      continue;
    }
    const { error: updErr } = await supabase.from("icons").update({ gruppe: group }).eq("id", ic.id);
    if (updErr) {
      console.warn(`  failed ${ic.label}: ${updErr.message}`);
      continue;
    }
    matched++;
  }

  console.log(`✓ ${matched}/${icons!.length} Icons gruppiert`);
  if (unmatched.length) {
    console.log(`⚠ ohne Zuordnung (${unmatched.length}):`, unmatched.join(", "));
  }

  // Übersicht
  const { data: after } = await supabase
    .from("icons")
    .select("gruppe, label")
    .order("gruppe")
    .order("label");
  const byGroup: Record<string, string[]> = {};
  for (const ic of after!) {
    const g = ic.gruppe ?? "(ohne Gruppe)";
    (byGroup[g] ??= []).push(ic.label);
  }
  console.log("\nErgebnis:");
  for (const [g, labels] of Object.entries(byGroup)) {
    console.log(`  ${g.padEnd(15)} (${labels.length})  ${labels.join(", ")}`);
  }
}
main();
