import Link from "next/link";
import type { ReactNode } from "react";
import { LayoutGrid, Layers, Package, Sparkles, LayoutTemplate, FileDown, Settings } from "lucide-react";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";
import { ToastListener } from "./toast-listener";

export async function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-md">
        <div className="max-w-screen-2xl mx-auto flex items-center gap-6 px-6 py-3">
          <Link href="/" className="flex items-center gap-3 group shrink-0 mr-2">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center font-bold text-primary text-xl shadow-sm group-hover:scale-105 transition-transform">
              L
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-lg tracking-wider block leading-none">LICHTSTUDIO</span>
              <span className="block text-[10px] text-accent/90 uppercase tracking-widest mt-0.5">Produktverwaltung</span>
            </div>
          </Link>

          <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
            <NavLink href="/bereiche" label="Bereiche"><LayoutGrid className="h-4 w-4" /></NavLink>
            <NavLink href="/kategorien" label="Kategorien"><Layers className="h-4 w-4" /></NavLink>
            <NavLink href="/produkte" label="Produkte"><Package className="h-4 w-4" /></NavLink>
            <NavLink href="/icons" label="Icons"><Sparkles className="h-4 w-4" /></NavLink>
            <NavLink href="/datenblatt-vorlagen" label="Vorlagen"><LayoutTemplate className="h-4 w-4" /></NavLink>
            <NavLink href="/export/katalog" label="Katalog"><FileDown className="h-4 w-4" /></NavLink>
            <NavLink href="/einstellungen" label="Einstellungen"><Settings className="h-4 w-4" /></NavLink>
          </nav>

          <div className="shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <ToastListener />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-8">
        {children}
      </main>

      <footer className="border-t bg-background py-3 text-center text-xs text-muted-foreground">
        LICHT.ENGROS S.R.L. &middot; Eisenkeil &middot; Lichtstudio Produktverwaltung
      </footer>
    </div>
  );
}
