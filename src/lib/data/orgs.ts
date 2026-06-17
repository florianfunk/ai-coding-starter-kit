import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { MOCK_MEMBERSHIPS } from "./mock";
import type { Membership, Role } from "./types";

// Memberships of the given user across all their organizations (RLS-scoped).
// Org names are fetched in a second query to avoid relying on embedded joins.
export async function getMembershipsForUser(
  userId: string,
): Promise<Membership[]> {
  if (!hasSupabaseEnv) return MOCK_MEMBERSHIPS;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("org_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error || !data) return [];

  const ids = data.map((m) => m.org_id);
  const { data: orgs } = ids.length
    ? await supabase.from("organizations").select("id, name").in("id", ids)
    : { data: [] as { id: string; name: string }[] };
  const nameById = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  return data.map((m) => ({
    orgId: m.org_id,
    orgName: nameById.get(m.org_id) ?? "—",
    role: m.role as Role,
  }));
}
