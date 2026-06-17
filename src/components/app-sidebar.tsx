"use client";

import { LayoutDashboard, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { Role } from "@/lib/data/types";

export function AppSidebar({ role }: { role: Role }) {
  const t = useTranslations("Nav");
  const pathname = usePathname(); // already locale-stripped

  const items = [
    {
      href: "/dashboard",
      label: t("dashboard"),
      icon: LayoutDashboard,
      show: true,
    },
    {
      href: "/settings/members",
      label: t("members"),
      icon: Users,
      show: role === "admin",
    },
  ].filter((i) => i.show);

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <BrandLogo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("platform")}</SidebarGroupLabel>
          <SidebarMenu>
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active}>
                    <Link href={item.href}>
                      <Icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
