// Inspektor: prueft, ob das Buchungsdatum beim Import korrekt geparst wurde.
//
// Sucht alle Buchungen, deren Empfaenger (case-insensitive) ein Suchmuster
// enthalten, und gibt fuer jede den rohen DB-Wert (buchung_datum) sowie das
// `datum_format` des zugeordneten Kontos aus. Damit laesst sich schnell
// erkennen, ob Tag/Monat beim Parsen vertauscht wurden (z. B. wenn ein
// US-Datum unter "auto" als DE-Datum interpretiert wurde).
//
// Aufruf:
//   npx tsx scripts/inspect-buchung-datum.ts <suchmuster>
//   npx tsx scripts/inspect-buchung-datum.ts "Kinderland"
//
// Voraussetzungen in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface BuchungRow {
  id: string;
  konto_id: string;
  buchung_datum: string;
  betrag: number;
  empfaenger: string | null;
  verwendungszweck: string | null;
}

interface KontoRow {
  id: string;
  bezeichnung: string;
  typ: string;
  mapping: Record<string, unknown> | null;
}

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  let inhalt: string;
  try {
    inhalt = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const zeile of inhalt.split("\n")) {
    const t = zeile.trim();
    if (t === "" || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function buildClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function formatDateDE(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function tauschenAlternative(iso: string): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const jahr = +m[1];
  const monat = +m[2];
  const tag = +m[3];
  if (tag > 12) return null; // nicht vertauschbar
  if (monat > 12) return null;
  const dim = new Date(jahr, tag, 0).getDate();
  if (monat > dim) return null;
  return `${m[1]}-${String(tag).padStart(2, "0")}-${String(monat).padStart(2, "0")}`;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const suche = process.argv[2];
  if (!suche || suche.trim().length < 2) {
    console.error('Usage: npx tsx scripts/inspect-buchung-datum.ts "<Empfaenger-Teil>"');
    process.exit(1);
  }
  const client = buildClient();

  const { data: buchungen, error } = await client
    .from("buchung")
    .select("id, konto_id, buchung_datum, betrag, empfaenger, verwendungszweck")
    .ilike("empfaenger", `%${suche}%`)
    .order("buchung_datum", { ascending: true })
    .limit(50);
  if (error) {
    console.error("Fehler:", error.message);
    process.exit(1);
  }
  const buchungenSafe = (buchungen ?? []) as BuchungRow[];
  if (buchungenSafe.length === 0) {
    console.log(`Keine Buchungen mit Empfaenger ~ "${suche}" gefunden.`);
    return;
  }

  const kontoIds = Array.from(new Set(buchungenSafe.map((b) => b.konto_id)));
  const { data: kontenData } = await client
    .from("konto")
    .select("id, bezeichnung, typ, mapping")
    .in("id", kontoIds);
  const konten = new Map<string, KontoRow>(
    (kontenData ?? []).map((k) => [k.id as string, k as KontoRow]),
  );

  console.log(`\nGefunden: ${buchungenSafe.length} Buchungen mit Empfaenger ~ "${suche}"\n`);
  console.log("Konten-Mapping (datum_format):");
  for (const id of kontoIds) {
    const k = konten.get(id);
    const fmt =
      (k?.mapping as { datum_format?: string } | null | undefined)
        ?.datum_format ?? "(nicht gesetzt, default=auto)";
    console.log(`  ${k?.bezeichnung ?? id} [${k?.typ ?? "?"}] -> datum_format=${fmt}`);
  }

  console.log("\nBuchungen (DB-Wert / Anzeige / alternative Interpretation):\n");
  console.log(
    "Datum (DB)    Datum (DE)    Wenn vertauscht    Betrag        Empfaenger".padEnd(110, " ") +
      "Zweck",
  );
  console.log("-".repeat(160));
  for (const b of buchungenSafe) {
    const alt = tauschenAlternative(b.buchung_datum);
    const altDe = alt ? formatDateDE(alt) : "—".padEnd(10);
    const empf = (b.empfaenger ?? "").slice(0, 32).padEnd(34);
    const zweck = (b.verwendungszweck ?? "").slice(0, 60);
    console.log(
      `${b.buchung_datum}   ${formatDateDE(b.buchung_datum)}   ${altDe}        ${b.betrag
        .toFixed(2)
        .padStart(10)}  ${empf} ${zweck}`,
    );
  }
  console.log("");
  console.log(
    "Hinweis: Wenn 'Wenn vertauscht' plausibler aussieht (z. B. monatliche Abstaende),",
  );
  console.log(
    "ist das Konto-Mapping wahrscheinlich auf das falsche datum_format gesetzt.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
