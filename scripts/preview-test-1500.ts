import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import {
  buildModernDatenblattPayload,
  renderModernDatenblattPdf,
} from "../src/lib/latex/datenblatt-modern-payload";

async function main() {
  config({ path: ".env.local" });
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: produkt } = await admin
    .from("produkte")
    .select("id")
    .eq("artikelnummer", "BL13528-60-4.8-2700-90-65")
    .single();
  if (!produkt) { console.error("Produkt nicht gefunden"); process.exit(1); }

  const TEST_RAW = (
    "Der LED-Streifen darf ausschliesslich mit einem geeigneten Kuehlprofil aus Aluminium betrieben werden, um die entstehende Verlustwaerme sicher abzufuehren. Halten Sie zu leicht entzuendlichen Materialien einen Mindestabstand von 5 cm ein. Eine Montage auf unebenen oder schlecht waermeleitenden Oberflaechen wie Rigips, Tapete, Holz, Leder oder Stein ist ausdruecklich zu vermeiden, da hier kein ausreichender Waermeabtransport gewaehrleistet ist. " +
    "In staub- oder wassergefaehrdeten Bereichen ist ein LED-Streifen mit der entsprechend geeigneten Schutzart einzusetzen. Achten Sie waehrend der Verlegung sorgfaeltig darauf, dass die Leiterbahnen weder geknickt, eingeklemmt noch beschaedigt werden, und kontrollieren Sie die korrekte Polung am Anschluss. Das Produkt darf keinem mechanischen Druck oder Zug ausgesetzt werden; alle Loetstellen muessen zum Profil hin sauber isoliert sein. " +
    "Beim Verbinden mehrerer LED-Module ist die maximal zulaessige Laenge eines durchgehenden Moduls strikt einzuhalten. Verwenden Sie ein Konstantspannungsnetzteil, das sowohl der Leistung als auch der Spannung des LED-Streifens entspricht; eine Ueber- oder Unterversorgung fuehrt zu vorzeitigem Ausfall. Kleben Sie den Streifen niemals ueber Profilstoss-Stellen hinweg, da temperaturbedingte Laengenaenderungen den Streifen beschaedigen koennen. " +
    "Teilen Sie den Streifen ausschliesslich an den vorgesehenen Loetpads und nutzen Sie flexible Verbindungen wie angeloetete Drahtbruecken, um Spannungen zwischen Profilabschnitten auszugleichen. Bei der Erstinbetriebnahme empfiehlt sich ein kurzer Funktionstest unter Volllast vor der finalen Endmontage."
  );
  // Auf 1500 Zeichen schneiden, an Wortgrenze.
  const TEST_TEXT_1500 = (() => {
    if (TEST_RAW.length <= 1500) return TEST_RAW;
    let cut = TEST_RAW.slice(0, 1500);
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > 1400) cut = cut.slice(0, lastSpace);
    return cut;
  })();
  console.log(`Test-Text Laenge: ${TEST_TEXT_1500.length} Zeichen`);

  // Patche datenblatt_text im geladenen Produkt-Objekt direkt im Builder.
  // Trick: monkey-patche supabase.from("produkte").select(...).single()
  const origFrom = admin.from.bind(admin);
  (admin as any).from = (table: string) => {
    const builder = origFrom(table) as any;
    if (table !== "produkte") return builder;
    const origSelect = builder.select.bind(builder);
    builder.select = (...args: any[]) => {
      const q = origSelect(...args);
      const origSingle = q.single.bind(q);
      q.single = async () => {
        const r = await origSingle();
        if (r.data && "datenblatt_text" in r.data) {
          r.data.datenblatt_text = TEST_TEXT_1500;
        }
        return r;
      };
      return q;
    };
    return builder;
  };

  const payload = await buildModernDatenblattPayload(admin as any, produkt.id, "lichtengros");
  console.log(`paragraphs left=${payload.paragraphs_left.length}, right=${payload.paragraphs_right.length}`);
  const pdf = await renderModernDatenblattPdf(payload);
  writeFileSync("tmp/test-1500-zeichen.pdf", pdf);
  console.log("→ tmp/test-1500-zeichen.pdf");
}
main().catch((e) => { console.error(e); process.exit(1); });
