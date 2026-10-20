import type { SupabaseClient } from "@supabase/supabase-js";

/** Monotone audit count detects hold AND resume while a snapshot is calculated. */
export async function ladeRueckstellungsVersion(db: SupabaseClient, ownerId: string): Promise<number> {
  const { count, error } = await db.from("audit_eintrag").select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId).in("aktion", ["steuerlich_zurueckgestellt", "steuerlich_wieder_aufgenommen"]);
  if (error || count === null) throw new Error("Rückstellungen konnten nicht geprüft werden.");
  return count;
}
