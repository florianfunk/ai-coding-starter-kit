import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { getMembershipsForUser } from "@/lib/data/orgs";
import { MOCK_MEMBERSHIPS } from "@/lib/data/mock";
import type { Membership, Role } from "@/lib/data/types";

export interface SessionContext {
  /** True when no Supabase project is configured yet (mock data is used). */
  preview: boolean;
  user: { id: string; email: string };
  memberships: Membership[];
  activeOrg: { id: string; name: string; role: Role } | null;
}

/**
 * Resolves the current session, the user's memberships and the active
 * organization (chosen via the `rg_active_org` cookie, falling back to the
 * first membership). Returns `null` when no authenticated user exists.
 */
export async function getSessionContext(
  activeOrgId?: string,
): Promise<SessionContext | null> {
  if (!hasSupabaseEnv) {
    // Preview mode: act as a signed-in admin so the full shell is reviewable.
    const active =
      MOCK_MEMBERSHIPS.find((m) => m.orgId === activeOrgId) ??
      MOCK_MEMBERSHIPS[0] ??
      null;
    return {
      preview: true,
      user: { id: "preview-user", email: "florian@demo-retail.de" },
      memberships: MOCK_MEMBERSHIPS,
      activeOrg: active
        ? { id: active.orgId, name: active.orgName, role: active.role }
        : null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const memberships = await getMembershipsForUser(user.id);
  const active =
    memberships.find((m) => m.orgId === activeOrgId) ?? memberships[0] ?? null;

  return {
    preview: false,
    user: { id: user.id, email: user.email ?? "" },
    memberships,
    activeOrg: active
      ? { id: active.orgId, name: active.orgName, role: active.role }
      : null,
  };
}
