// PROJ-18 — Re-Normalisierung: rechnet empfaenger_normalisiert fuer ALLE
// bestehenden Buchungen neu und aktualisiert nur die Zeilen, bei denen sich
// der Wert gegenueber dem gespeicherten unterscheidet. Noetig, nachdem
// normalisiereEmpfaenger() erweitert wurde (Marken-Verdichtung gegen
// Filial-/Stadt-/Order-Token-Fragmentierung).
//
// Unterschied zu backfill-empfaenger-normalisiert.ts: jenes fasst nur
// IS-NULL-Zeilen an. Dieses Skript re-normalisiert ALLE Zeilen.
//
// Aufruf:
//   npx tsx scripts/renormalisiere-empfaenger.ts [--dry-run]
//
// Voraussetzungen in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL=https://<proj>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # NIE committen
//
// Verwendet den Service-Role-Key (RLS-Bypass) — laeuft single-tenant ueber
// alle Owner. Wird vom Inhaber lokal ausgefuehrt; der Key gelangt NICHT in
// den Agent-/App-Kontext.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalisiereEmpfaenger } from "../src/lib/classifier/normalize";

interface BuchungZeile {
  id: string;
  empfaenger: string | null;
  empfaenger_normalisiert: string | null;
}

const PAGE_SIZE = 1000;

/** Minimaler .env.local-Loader (keine dotenv-Dependency im Projekt). */
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

/** Lade eine Seite Buchungen (stabil nach id sortiert) via Range-Pagination. */
async function ladeSeite(
  client: SupabaseClient,
  von: number,
): Promise<BuchungZeile[]> {
  const { data, error } = await client
    .from("buchung")
    .select("id, empfaenger, empfaenger_normalisiert")
    .order("id", { ascending: true })
    .range(von, von + PAGE_SIZE - 1);
  if (error) {
    throw new Error(`Read fehlgeschlagen: ${error.message}`);
  }
  return (data ?? []) as BuchungZeile[];
}

async function schreibeBatch(
  client: SupabaseClient,
  updates: Array<{ id: string; wert: string }>,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  const parallel = 5;
  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const idx = cursor++;
      if (idx >= updates.length) return;
      const u = updates[idx];
      const { error } = await client
        .from("buchung")
        .update({ empfaenger_normalisiert: u.wert })
        .eq("id", u.id);
      if (error) {
        throw new Error(`Update fehlgeschlagen fuer ${u.id}: ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker));
}

async function main(): Promise<void> {
  loadEnvLocal();
  const dryRun = new Set(process.argv.slice(2)).has("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein.",
    );
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(
    dryRun
      ? "[DRY-RUN] Keine Aenderungen — nur Plan."
      : "[LIVE] Schreibt geaenderte Normalisierungen in die DB.",
  );

  let von = 0;
  let gelesen = 0;
  let geaendert = 0;
  const beispiele: Array<{ alt: string; neu: string; roh: string }> = [];

  for (;;) {
    const seite = await ladeSeite(client, von);
    if (seite.length === 0) break;

    const updates: Array<{ id: string; wert: string }> = [];
    for (const row of seite) {
      const neu = normalisiereEmpfaenger(row.empfaenger);
      const alt = row.empfaenger_normalisiert ?? "";
      if (neu !== alt) {
        updates.push({ id: row.id, wert: neu });
        if (beispiele.length < 40) {
          beispiele.push({ alt, neu, roh: row.empfaenger ?? "" });
        }
      }
    }

    await schreibeBatch(client, updates, dryRun);

    gelesen += seite.length;
    geaendert += updates.length;
    console.log(
      `… ${gelesen} gelesen, ${geaendert} geaendert (Seite ab ${von})`,
    );

    if (seite.length < PAGE_SIZE) break;
    von += PAGE_SIZE;
  }

  console.log("\n=== Zusammenfassung ===");
  console.log(`Modus:            ${dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`Gelesene Zeilen:  ${gelesen}`);
  console.log(`Geaenderte Zeilen:${geaendert}`);
  console.log(`\nBeispiel-Aenderungen (max 40):`);
  for (const b of beispiele) {
    console.log(`  "${b.alt}"  →  "${b.neu}"   [roh: ${b.roh}]`);
  }
  console.log("\nFertig.");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nAbgebrochen: ${msg}`);
  process.exit(1);
});
