import Link from "next/link";
import type { ReactNode } from "react";
import { LayoutGrid, Layers, Package, FileDown, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/bereiche", label: "Bereiche", icon: LayoutGrid },
  { href: "/kategorien", label: "Kategorien", icon: Layers },
  { href: "/produkte", label: "Produkte", icon: Package },
  { href: "/export/katalog", label: "Katalog-Export", icon: FileDown },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

export async function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center font-bold text-lg group-hover:bg-white/25 transition">
              L
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-lg tracking-wider">LICHTSTUDIO</span>
              <span className="block text-xs text-white/60 -mt-0.5">Produktverwaltung v2.0</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:block text-xs text-white/60">
            Auth deaktiviert (dev)
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-8">
        {children}
      </main>

      <footer className="border-t bg-background py-3 text-center text-xs text-muted-foreground">
        LICHT.ENGROS S.R.L. / Eisenkeil &middot; Lichtstudio Produktverwaltung
      </footer>
    </div>
  );
}
