"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getWorkspaceForPath } from "./workspace";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const workspace = getWorkspaceForPath(pathname);

  return (
    <Sidebar
      collapsible="icon"
      className="top-[56px] !h-[calc(100vh-56px)] border-r border-[rgba(0,0,0,0.25)]"
    >
      <SidebarContent className="gap-3.5 px-2.5 pt-3">
        <div className="px-2.5 pb-1 group-data-[collapsible=icon]:hidden">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/35">
            {workspace.label}
          </span>
        </div>

        {workspace.sidebar.map((group) => (
          <SidebarGroup key={`${workspace.id}-${group.label}`} className="gap-0 py-0">
            <SidebarGroupLabel className="px-2.5 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.11em] text-white/40">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-px">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        className={`relative h-auto gap-[11px] rounded-lg px-2.5 py-2 text-[13.5px] transition-colors ${
                          active
                            ? "!bg-[rgba(217,4,22,0.16)] !text-white font-semibold shadow-[inset_0_0_0_0.5px_rgba(217,4,22,0.28)] hover:!bg-[rgba(217,4,22,0.2)]"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Link href={item.href} aria-label={item.label}>
                          {active && (
                            <span
                              aria-hidden
                              className="absolute -left-[13px] top-1.5 bottom-1.5 w-[3px] rounded-r-[3px]"
                              style={{
                                background: "#D90416",
                                boxShadow: "0 0 8px rgba(217,4,22,0.6)",
                              }}
                            />
                          )}
                          <Icon
                            className="!size-4"
                            style={{ color: active ? "#ff4d5a" : "rgba(255,255,255,0.55)" }}
                          />
                          <span className="flex-1 text-left">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {workspace.showSuggestionCard && (
        <SidebarFooter className="gap-2.5 px-2.5 pb-3">
          <div className="rounded-[11px] border-[0.5px] border-white/10 bg-white/5 p-3 group-data-[collapsible=icon]:hidden">
            <div className="mb-1.5 flex items-center gap-2">
              <div
                className="grid h-5 w-5 place-items-center rounded-[6px] text-white shadow-[0_2px_8px_rgba(217,4,22,0.35),inset_0_0.5px_0_rgba(255,255,255,0.25)]"
                style={{ background: "#D90416" }}
              >
                <Sparkles className="h-[11px] w-[11px]" />
              </div>
              <span className="text-[12px] font-semibold tracking-[-0.005em] text-white">
                Vorschläge bereit
              </span>
            </div>
            <p className="mb-2.5 text-[11.5px] leading-[1.4] text-white/60">
              KI-Beschreibungen warten auf Prüfung.
            </p>
            <Link
              href="/produkte?status=unbearbeitet"
              className="flex h-7 w-full items-center justify-center rounded-[7px] text-[12px] font-semibold tracking-[-0.003em] text-white shadow-[0_2px_8px_rgba(217,4,22,0.35),inset_0_0.5px_0_rgba(255,255,255,0.25)]"
              style={{ background: "#D90416" }}
            >
              Jetzt prüfen
            </Link>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
