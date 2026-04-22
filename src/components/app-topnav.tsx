"use client";

import Link from "next/link";
import { Bell, Lightbulb } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { CommandPaletteWithTrigger } from "./command-palette";
import { UserMenu } from "./user-menu";

export function AppTopNav() {
  return (
    <header className="topnav-bar sticky top-0 z-40 flex h-[52px] items-center gap-2 px-5">
      <Link href="/" className="mr-4 flex items-center gap-2.5">
        <div className="brand-logo grid h-[22px] w-[22px] place-items-center rounded-[7px] text-white">
          <Lightbulb className="h-3.5 w-3.5" />
        </div>
        <span className="text-[14px] font-semibold tracking-tight">Lichtengros</span>
        <span className="pill !px-[7px] !py-[2px] text-[10px]">PIM</span>
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <CommandPaletteWithTrigger />
        <button
          type="button"
          aria-label="Benachrichtigungen"
          className="grid h-[34px] w-[34px] place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <Bell className="h-4 w-4" />
        </button>
        <ThemeToggle />
        <div className="mx-0.5 h-5 w-px bg-border" />
        <UserMenu />
      </div>
    </header>
  );
}
