import { setRequestLocale } from "next-intl/server";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);

  // The invitation token is validated server-side by accept_invitation() when
  // the user accepts (the invitee cannot read the invitation row directly).
  return <AcceptInviteForm token={token ?? null} />;
}
