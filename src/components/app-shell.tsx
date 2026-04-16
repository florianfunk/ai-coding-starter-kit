import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export async function AppShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-semibold tracking-wide">
            LICHTSTUDIO
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/bereiche" className="hover:underline">Bereiche</Link>
            <Link href="/kategorien" className="hover:underline">Kategorien</Link>
            <Link href="/produkte" className="hover:underline">Produkte</Link>
            <Link href="/einstellungen" className="hover:underline">Einstellungen</Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {user && <span className="text-muted-foreground">{user.email}</span>}
            <form action={logoutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Abmelden
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
