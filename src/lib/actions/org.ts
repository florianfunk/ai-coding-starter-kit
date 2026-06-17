"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const ACTIVE_ORG_COOKIE = "rg_active_org";
const nameSchema = z.string().trim().min(1).max(120);

// Bootstrap: a signed-in user creates a new organization and becomes its admin.
export async function createOrganizationAction(
  name: string,
): Promise<{ ok: boolean; orgId?: string; error?: string }> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "invalid_name" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "failed" };

  (await cookies()).set(ACTIVE_ORG_COOKIE, data, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return { ok: true, orgId: data };
}
