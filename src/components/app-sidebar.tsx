"use client";

/*
 * Cobalt-Sidebar im Editorial-Stil:
 *  - Tinted Sunk-Surface, Haarlinien-Rand
 *  - Marken-Quadrat mit Serif-Italic (Source Serif)
 *  - Sektions-Eyebrows in Caps mit weitem Tracking
 *  - Aktive Pille füllt komplett mit Cobalt-Akzent (kein Glaseffekt)
 *  - Theme-Toggle + Abmelden im Footer
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/buchungen", label: "Buchungen" },
  { href: "/kategorien-analyse", label: "Kategorien-Analyse" },
  { href: "/kuendigungen", label: "Kündigungen" },
  { href: "/pruefliste", label: "Prüfliste" },
  { href: "/abgleich", label: "Beleg-Abgleich" },
  { href: "/belege", label: "Belege" },
  { href: "/ust-voranmeldung", label: "USt-Voranmeldung" },
  { href: "/euer", label: "EÜR" },
  { href: "/einkommensteuer", label: "Einkommensteuer" },
  { href: "/export", label: "Export" },
];

const SETTINGS = [
  { href: "/profil", label: "Mein Profil" },
  { href: "/einstellungen/firma", label: "Firma & Steuerprofil" },
  { href: "/einstellungen/kontenrahmen", label: "Kontenrahmen" },
  { href: "/einstellungen/konten", label: "Bankkonten" },
  { href: "/einstellungen/paperless", label: "Paperless" },
  { href: "/einstellungen/regeln", label: "Lernregeln" },
  { href: "/einstellungen/admin", label: "Admin" },
];

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-[13.5px] font-medium tracking-[-0.005em] bg-primary text-primary-foreground"
          : "flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-[13.5px] font-normal tracking-[-0.005em] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      }
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1.5 pt-3.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-subtle)]">
      {children}
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const istAktiv = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r p-3 md:flex"
      style={{ background: "var(--surface-sunk)", borderColor: "var(--line)" }}
    >
      {/* Markenkopf */}
      <div className="mb-5 flex items-center gap-2.5 px-2 pt-1">
        <div
          className="grid h-[30px] w-[30px] place-items-center rounded-md font-display text-[19px] italic font-semibold leading-none tracking-[-0.02em]"
          style={{
            background: "var(--accent-color)",
            color: "var(--accent-fg)",
            boxShadow: "0 2px 8px var(--accent-ring)",
          }}
        >
          S
        </div>
        <div className="min-w-0">
          <div className="font-display text-[17px] leading-none tracking-[-0.01em]">
            STEUERAGENT
          </div>
          <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-subtle)]">
            Autonome Buchhaltung
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-0">
        <SectionTitle>Arbeit</SectionTitle>
        {NAV.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            active={istAktiv(item.href)}
          />
        ))}

        <SectionTitle>Einstellungen</SectionTitle>
        {SETTINGS.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            active={istAktiv(item.href)}
          />
        ))}
      </nav>

      {/* Footer */}
      <div
        className="mt-3 space-y-3 border-t pt-3"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="flex justify-center">
          <ThemeToggle />
        </div>
        <form action="/auth/signout" method="post">
          <Button variant="outline" size="sm" className="w-full">
            Abmelden
          </Button>
        </form>
      </div>
    </aside>
  );
}
