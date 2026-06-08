import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSessionContext } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get("rg_active_org")?.value;
  const ctx = await getSessionContext(activeOrgId);

  if (!ctx) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (!ctx.activeOrg) {
    redirect({ href: "/no-organization", locale });
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar role={ctx.activeOrg.role} />
      <SidebarInset>
        <AppHeader
          email={ctx.user.email}
          memberships={ctx.memberships}
          activeOrgId={ctx.activeOrg.id}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
