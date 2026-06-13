// Diagnose-Skript: was hat der Chat tatsaechlich in die DB geschrieben?
// Aufruf: npx tsx scripts/check-chat-stand.ts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
for (const z of env.split("\n")) {
  const t = z.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 0) continue;
  const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[t.slice(0, eq).trim()]) {
    process.env[t.slice(0, eq).trim()] = v;
  }
}

async function main() {
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

console.log("=== Letzte 10 chat_aktion ===");
const { data: aktionen, error: e1 } = await sb
  .from("chat_aktion")
  .select("aktion, status, vorschau, created_at, fehler_text")
  .order("created_at", { ascending: false })
  .limit(10);
if (e1) console.error(e1);
console.log(JSON.stringify(aktionen, null, 2));

console.log("\n=== Letzte 10 Nachrichten (gekuerzt, mit Tool-Spur) ===");
const { data: nachrichten, error: e2 } = await sb
  .from("chat_nachricht")
  .select("id, rolle, inhalt, tool_calls, tool_results, created_at")
  .order("created_at", { ascending: false })
  .limit(10);
if (e2) console.error(e2);
for (const n of nachrichten ?? []) {
  const tcs = n.tool_calls ? JSON.stringify(n.tool_calls).slice(0, 200) : "(keine)";
  console.log(`\n[${n.rolle}] ${(n.inhalt || "").slice(0, 100)}`);
  console.log(`  tool_calls: ${tcs}`);
}

console.log("\n=== Kategorien mit 'test chat' ===");
const { data: kat } = await sb
  .from("kategorie")
  .select("id, bezeichnung, typ, ust_satz, created_at")
  .ilike("bezeichnung", "%test%chat%");
console.log(JSON.stringify(kat, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
