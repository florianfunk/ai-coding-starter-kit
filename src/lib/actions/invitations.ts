"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import { start } from "workflow/api";
import { createClient } from "@/lib/supabase/server";
import { mapActionError } from "@/lib/action-errors";
import { sendInvitationWorkflow } from "@/workflows/invitation";

const inviteSchema = z.object({
  orgId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "analyst", "viewer"]),
  locale: z.string().default("de"),
});

export async function inviteMemberAction(
  input: z.input<typeof inviteSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { orgId, email, role, locale } = parsed.data;
  const lowerEmail = email.toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const token = randomBytes(32).toString("hex");

  // RLS (invitations_insert_admin) ensures only admins of orgId may insert.
  const { error } = await supabase.from("invitations").insert({
    org_id: orgId,
    email: lowerEmail,
    role,
    token,
    invited_by: user.id,
  });
  if (error) return { ok: false, error: mapActionError(error) };

  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor: user.id,
    action: "invitation.create",
    target: lowerEmail,
    metadata: { role },
  });

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // Durable email delivery. If the workflow runtime is unavailable, fall back to
  // logging the link so the invite is never silently lost.
  try {
    await start(sendInvitationWorkflow, [
      {
        email: lowerEmail,
        token,
        role,
        orgName: org?.name ?? "RiskGuard",
        locale,
        siteUrl,
      },
    ]);
  } catch (e) {
    console.error(
      `[invite] workflow start failed — link: ${siteUrl}/${locale}/accept-invite?token=${token}`,
      e,
    );
  }

  return { ok: true };
}

export async function revokeInvitationAction(
  invitationId: string,
  orgId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor: user.id,
    action: "invitation.revoke",
    target: invitationId,
  });
  return { ok: true };
}
