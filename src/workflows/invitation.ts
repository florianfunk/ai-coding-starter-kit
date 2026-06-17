import { RetryableError } from "workflow";

export interface InvitationEmailInput {
  email: string;
  token: string;
  role: string;
  orgName: string;
  locale: string;
  siteUrl: string;
}

// First durable workflow of the platform: delivering an invitation email.
// Orchestration only — the actual I/O lives in the step below (auto-retried,
// result persisted = audit trail). The invitation row itself is written in the
// server action (RLS-authorized), so this workflow needs no DB credentials.
export async function sendInvitationWorkflow(input: InvitationEmailInput) {
  "use workflow";
  await deliverInvitationEmail(input);
}

async function deliverInvitationEmail(input: InvitationEmailInput) {
  "use step";

  const link = `${input.siteUrl}/${input.locale}/accept-invite?token=${input.token}`;
  const apiKey = process.env.RESEND_API_KEY;

  // Dev fallback: no Resend key configured → log the link instead of sending.
  if (!apiKey) {
    console.log(
      `[RiskGuard] Einladung für ${input.email} (Organisation: ${input.orgName}, Rolle: ${input.role}): ${link}`,
    );
    return { delivered: false, reason: "no_resend_key" as const };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "RiskGuard <onboarding@resend.dev>",
    to: input.email,
    subject: `Einladung zu ${input.orgName} – RiskGuard`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px">
        <h2>Einladung zu ${input.orgName}</h2>
        <p>Du wurdest als <strong>${input.role}</strong> zu RiskGuard eingeladen.</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Einladung annehmen</a></p>
        <p style="color:#666;font-size:13px">Oder kopiere diesen Link: ${link}</p>
      </div>`,
  });

  // Transient provider errors → retry; the workflow guarantees eventual delivery.
  if (error) throw new RetryableError(`Resend error: ${error.message ?? "unknown"}`);
  return { delivered: true as const };
}
