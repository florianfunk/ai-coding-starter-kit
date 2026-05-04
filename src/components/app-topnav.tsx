"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Lightbulb, ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { useTransition } from "react";
import { ThemeToggle } from "./theme-toggle";
import { CommandPaletteWithTrigger } from "./command-palette";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { logoutAction } from "@/app/login/actions";
import { WORKSPACES, getWorkspaceForPath } from "./workspace";
import { useWorkspaceLastPage } from "./use-workspace-last-page";

type SessionUser = { email: string | null; name: string | null };

export function AppTopNav({ user }: { user?: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { getTargetForWorkspace } = useWorkspaceLastPage();

  const activeWorkspace = getWorkspaceForPath(pathname);

  const displayName = user?.name ?? (user?.email ? user.email.split("@")[0] : "Gast");
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "LM";
  const role = user?.email ? "Katalog-Manager" : "Interne Pflege";

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <header className="topnav-bar sticky top-0 z-40 flex h-[56px] items-center gap-0.5 px-[18px]">
      <SidebarTrigger className="topnav-btn -ml-1 !bg-transparent" />

      <Link href="/" className="mr-5 ml-1 flex items-center gap-2.5">
        <div
          className="grid h-[22px] w-[22px] place-items-center rounded-[7px] text-white shadow-[inset_0_0.5px_0_rgba(255,255,255,0.25)]"
          style={{ background: "#D90416" }}
        >
          <Lightbulb className="h-3.5 w-3.5" />
        </div>
        <span className="text-[14px] font-semibold tracking-tight text-white">Lichtengros</span>
        <span className="rounded-[5px] bg-white/10 px-[7px] py-[3px] text-[9.5px] font-bold uppercase tracking-[0.1em] text-white/75">
          PIM
        </span>
      </Link>

      <TooltipProvider delayDuration={200}>
        <nav className="nav-links flex items-center gap-0.5" aria-label="Workspaces">
          {WORKSPACES.map((ws) => {
            const active = ws.id === activeWorkspace.id;
            const Icon = ws.icon;
            const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
              e.preventDefault();
              if (active) return;
              const target = getTargetForWorkspace(ws.id);
              router.push(target);
            };

            return (
              <Tooltip key={ws.id}>
                <TooltipTrigger asChild>
                  <a
                    href={ws.landingPath}
                    onClick={handleClick}
                    aria-current={active ? "page" : undefined}
                    className={`navlink-dark flex items-center gap-1.5 ${active ? "active" : ""}`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden md:inline">{ws.label}</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="md:hidden">
                  {ws.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </TooltipProvider>

      <div className="flex-1" />

      <CommandPaletteWithTrigger />

      <ThemeToggle />

      <button
        type="button"
        aria-label="Benachrichtigungen"
        className="topnav-btn"
      >
        <Bell className="h-4 w-4" />
        <span className="absolute right-[8px] top-[8px] h-[6px] w-[6px] rounded-full bg-[#ff453a]" />
      </button>

      <div className="mx-1.5 h-5 w-px bg-white/15" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="user-btn-dark">
            <div
              className="grid h-[28px] w-[28px] place-items-center rounded-full text-[11px] font-bold leading-none tracking-[-0.01em] text-white"
              style={{ background: "#D90416" }}
            >
              {initials}
            </div>
            <div className="user-meta text-left leading-[1.2]">
              <div className="text-[12.5px] font-semibold text-white">{displayName}</div>
              <div className="text-[10.5px] text-white/55">{role}</div>
            </div>
            <ChevronDown className="h-3 w-3 text-white/55" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 rounded-lg">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="font-medium">{displayName}</span>
              {user?.email && (
                <span className="text-xs text-muted-foreground">{user.email}</span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/benutzer/profil" className="cursor-pointer">
              <UserIcon className="mr-2 h-4 w-4" />
              Mein Profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={pending}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
