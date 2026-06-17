"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Accept an invitation by token (validated server-side by the RPC).
export async function acceptInvitationAction(
  token: string,
): Promise<{ ok: boolean; orgId?: string; error?: string }> {
  if (!token) return { ok: false, error: "invalid" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "failed" };
  }

  (await cookies()).set("rg_active_org", data, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return { ok: true, orgId: data };
}
