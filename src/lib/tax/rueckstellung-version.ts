import type { SupabaseClient } from "@supabase/supabase-js";

/** Append-only hold audits detect hold AND resume even across booking deletes. */
export async function ladeRueckstellungsVersion(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc("steuer_rueckstellungs_version");
  if (error || data === null || !Number.isSafeInteger(Number(data))) throw new Error("Rückstellungen konnten nicht geprüft werden.");
  return Number(data);
}
