import type { ReactNode } from "react";
import { AppTopNav } from "./app-topnav";
import { AppSidebar } from "./app-sidebar";
import { ToastListener } from "./toast-listener";
import { GlobalShortcuts } from "./global-shortcuts";

export async function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppTopNav />
      <ToastListener />
      <GlobalShortcuts />
      <div className="flex items-start">
        <AppSidebar />
        <main className="min-w-0 flex-1 px-6 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <footer className="mx-auto max-w-screen-2xl py-4 text-center text-[11px] text-muted-foreground">
        LICHT.ENGROS S.R.L. · Eisenkeil · Lichtstudio
      </footer>
    </div>
  );
}
