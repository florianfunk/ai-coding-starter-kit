import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { MOCK_MEMBERS, MOCK_INVITES } from "./mock";
import type {
  Invitation,
  InviteStatus,
  Member,
  MemberStatus,
  Role,
} from "./types";

// Members of an organization (RLS: only visible to co-members). Profiles are
// fetched separately because there is no direct FK memberships→profiles.
export async function listMembers(orgId: string): Promise<Member[]> {
  if (!hasSupabaseEnv) return MOCK_MEMBERS;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: mems } = await supabase
    .from("memberships")
    .select("user_id, role, status")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (!mems) return [];

  const ids = mems.map((m) => m.user_id);
  const { data: profs } = ids.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const byId = new Map((profs ?? []).map((p) => [p.id, p]));

  return mems.map((m) => {
    const p = byId.get(m.user_id);
    return {
      id: m.user_id,
      name: p?.full_name ?? null,
      email: p?.email ?? "—",
      role: m.role as Role,
      status: m.status as MemberStatus,
      isSelf: m.user_id === user?.id,
    };
  });
}

export async function listPendingInvites(
  orgId: string,
): Promise<Invitation[]> {
  if (!hasSupabaseEnv) return MOCK_INVITES.filter((i) => i.status === "pending");

  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select("id, email, role, status, created_at")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (!data) return [];

  return data.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role as Role,
    status: i.status as InviteStatus,
    invitedAt: i.created_at,
  }));
}
