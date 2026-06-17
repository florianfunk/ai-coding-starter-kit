"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { OrgSwitcher } from "@/components/org-switcher";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import type { Membership } from "@/lib/data/types";

export function AppHeader({
  email,
  memberships,
  activeOrgId,
}: {
  email: string;
  memberships: Membership[];
  activeOrgId: string | null;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-6" />
      <OrgSwitcher memberships={memberships} activeOrgId={activeOrgId} />
      <div className="ml-auto flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu email={email} />
      </div>
    </header>
  );
}
