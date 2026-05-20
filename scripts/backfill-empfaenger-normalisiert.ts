// PROJ-15 — Backfill: setzt empfaenger_normalisiert fuer alle bestehenden
// Buchungen, die noch NULL haben. Idempotent: kann mehrfach laufen,
// fasst nur Zeilen mit empfaenger_normalisiert IS NULL an.
//
// Aufruf:
//   npx tsx scripts/backfill-empfaenger-normalisiert.ts [--dry-run]
//
// Voraussetzungen in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL=https://<proj>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # NIE committen
//
// Verwendet den Service-Role-Key (RLS-Bypass) — laeuft single-tenant ueber
// alle Owner. Der Service-Role-Key DARF NICHT in den Agent-/App-Kontext
// gelangen; das Skript wird vom Inhaber lokal/serverseitig ausgefuehrt.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalisiereEmpfaenger } from "../src/lib/classifier/normalize";

interface BuchungZeile {
  id: string;
  empfaenger: string | null;
}

const BATCH_SIZE = 500;

/**
 * Minimaler .env-Loader — wir wollen keine zusaetzliche Dependency (dotenv
 * ist nicht im Projekt). Liest KEY=VALUE Zeilen, ignoriert Kommentare und
 * leere Zeilen. Werte koennen in Anfuehrungszeichen stehen.
 */
function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  let inhalt: string;
  try {
    inhalt = readFileSync(path, "utf8");
  } catch {
    // .env.local optional — vielleicht sind die Variablen schon im
    // Process-Env (z. B. wenn das Skript aus einer CI-Pipeline laeuft).
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

interface ProgressState {
  verarbeitet: number;
  geaendert: number;
  batches: number;
  normalisierungen: Map<string, number>;
}

/** Lade einen Batch unverarbeiteter Buchungen (id + empfaenger). */
async function ladeBatch(
  client: SupabaseClient,
): Promise<BuchungZeile[]> {
  const { data, error } = await client
    .from("buchung")
    .select("id, empfaenger")
    .is("empfaenger_normalisiert", null)
    .limit(BATCH_SIZE);
  if (error) {
    throw new Error(`Batch-Read fehlgeschlagen: ${error.message}`);
  }
  return (data ?? []) as BuchungZeile[];
}

/**
 * Schreibt empfaenger_normalisiert pro Buchung. Supabase-PG-Client hat keine
 * effiziente Bulk-UPDATE-by-id-Variante, also Promise.all mit beschraenkter
 * Parallelitaet (max 5 gleichzeitig).
 */
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
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen in .env.local oder Umgebung gesetzt sein.",
    );
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(
    dryRun
      ? "[DRY-RUN] Es werden keine Aenderungen geschrieben — nur Plan ausgegeben."
      : "[LIVE] Schreibt Aenderungen in die Datenbank.",
  );

  // Gesamt-Vorab-Count zur Anzeige (RLS-Bypass via service-role).
  const { count: gesamt, error: countErr } = await client
    .from("buchung")
    .select("id", { count: "exact", head: true })
    .is("empfaenger_normalisiert", null);
  if (countErr) {
    console.error(`Gesamtzaehlung fehlgeschlagen: ${countErr.message}`);
    process.exit(1);
  }
  const erwarteteBatches =
    gesamt && gesamt > 0 ? Math.ceil(gesamt / BATCH_SIZE) : 0;
  console.log(`Zu verarbeitende Buchungen: ${gesamt ?? 0}`);
  console.log(`Erwartete Batches: ${erwarteteBatches}`);

  const state: ProgressState = {
    verarbeitet: 0,
    geaendert: 0,
    batches: 0,
    normalisierungen: new Map(),
  };

  for (;;) {
    const batch = await ladeBatch(client);
    if (batch.length === 0) break;

    const updates: Array<{ id: string; wert: string }> = [];
    for (const row of batch) {
      const norm = normalisiereEmpfaenger(row.empfaenger);
      updates.push({ id: row.id, wert: norm });
      if (norm !== "") {
        state.normalisierungen.set(
          norm,
          (state.normalisierungen.get(norm) ?? 0) + 1,
        );
      }
    }

    await schreibeBatch(client, updates, dryRun);

    state.batches += 1;
    state.verarbeitet += batch.length;
    state.geaendert += updates.length;

    console.log(
      `[${state.batches}/${erwarteteBatches || "?"}] ${batch.length} Buchungen normalisiert (insgesamt ${state.verarbeitet})`,
    );

    // Sicherheitsnetz: bei DRY-RUN wuerden die Zeilen sonst immer wieder
    // geladen werden — wir brechen nach einem Batch ab, weil sonst eine
    // Endlosschleife entstehen wuerde (NULL bleibt NULL).
    if (dryRun) {
      console.log(
        "[DRY-RUN] Da nicht geschrieben wird, bleiben Folge-Batches identisch — Abbruch nach erstem Batch.",
      );
      break;
    }
  }

  // Top 10 normalisierte Empfaenger ausgeben (Plausibilitaetspruefung).
  const top = [...state.normalisierungen.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log("\n=== Zusammenfassung ===");
  console.log(`Modus:               ${dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`Verarbeitete Zeilen: ${state.verarbeitet}`);
  console.log(`Distinct normalisiert: ${state.normalisierungen.size}`);
  console.log(`\nTop 10 normalisierte Empfaenger:`);
  if (top.length === 0) {
    console.log("(keine)");
  } else {
    for (const [name, anzahl] of top) {
      console.log(`  ${anzahl.toString().padStart(5)} x  ${name}`);
    }
  }
  console.log("\nFertig.");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nAbgebrochen: ${msg}`);
  process.exit(1);
});
