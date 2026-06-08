import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSessionContext } from "@/lib/auth";
import { listMembers, listPendingInvites } from "@/lib/data/members";
import { MembersTable } from "@/components/members/members-table";
import { InviteMemberDialog } from "@/components/members/invite-member-dialog";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Members");

  const cookieStore = await cookies();
  const ctx = await getSessionContext(cookieStore.get("rg_active_org")?.value);
  if (!ctx || !ctx.activeOrg) {
    redirect({ href: "/dashboard", locale });
    return null;
  }

  if (ctx.activeOrg.role !== "admin") {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("onlyAdmin")}</p>
      </div>
    );
  }

  const [members, invites] = await Promise.all([
    listMembers(ctx.activeOrg.id),
    listPendingInvites(ctx.activeOrg.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <InviteMemberDialog orgId={ctx.activeOrg.id} locale={locale} />
      </div>
      <MembersTable
        members={members}
        invites={invites}
        orgId={ctx.activeOrg.id}
      />
    </div>
  );
}
