"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mapActionError } from "@/lib/action-errors";

const roleEnum = z.enum(["admin", "analyst", "viewer"]);
const statusEnum = z.enum(["active", "deactivated"]);

async function actor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function changeMemberRoleAction(
  orgId: string,
  userId: string,
  role: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = roleEnum.safeParse(role);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, user } = await actor();
  if (!user) return { ok: false, error: "not_authenticated" };

  // RLS (memberships_update_admin) ensures only admins may update.
  const { error } = await supabase
    .from("memberships")
    .update({ role: parsed.data })
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: mapActionError(error) };

  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor: user.id,
    action: "member.change_role",
    target: userId,
    metadata: { role: parsed.data },
  });
  return { ok: true };
}

export async function setMemberStatusAction(
  orgId: string,
  userId: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = statusEnum.safeParse(status);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, user } = await actor();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("memberships")
    .update({ status: parsed.data })
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: mapActionError(error) };

  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor: user.id,
    action: "member.set_status",
    target: userId,
    metadata: { status: parsed.data },
  });
  return { ok: true };
}

export async function removeMemberAction(
  orgId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await actor();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: mapActionError(error) };

  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor: user.id,
    action: "member.remove",
    target: userId,
  });
  return { ok: true };
}
