import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppTopNav } from "./app-topnav";
import { AppSidebar } from "./app-sidebar";
import { ToastListener } from "./toast-listener";
import { GlobalShortcuts } from "./global-shortcuts";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";

export async function AppShell({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sessionUser = user
    ? {
        email: user.email ?? null,
        name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
      }
    : undefined;

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="flex min-h-svh flex-col">
      <AppTopNav user={sessionUser} />
      <div className="flex flex-1 min-h-0">
        <AppSidebar />
        <SidebarInset className="bg-transparent">
          <ToastListener />
          <GlobalShortcuts />
          <main className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 px-6 py-6 lg:px-8 lg:py-8">
            {children}
          </main>
          <footer className="mx-auto max-w-[1400px] py-4 text-center text-[11px] text-muted-foreground">
            LICHT.ENGROS S.R.L. · Eisenkeil · Lichtstudio
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
