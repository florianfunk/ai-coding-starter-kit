import type { SupabaseClient } from "@supabase/supabase-js";

/** DB-controlled per-booking versions detect hold AND resume during closure. */
export async function ladeRueckstellungsVersion(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc("steuer_rueckstellungs_version");
  if (error || data === null || !Number.isSafeInteger(Number(data))) throw new Error("Rückstellungen konnten nicht geprüft werden.");
  return Number(data);
}
