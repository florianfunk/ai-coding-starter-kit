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
// PROJ-29: Navigationsstruktur lebt jetzt in einer gemeinsamen Quelle,
// die auch die Command-Palette nutzt (AC3) — kein Duplikat mehr.
import { NAV_SEKTIONEN, SECTION_COLORS } from "@/lib/navigation";

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
          ? "flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13.5px] font-semibold tracking-[-0.005em] bg-brand-violet text-white"
          : "flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13.5px] font-medium tracking-[-0.005em] text-foreground/75 hover:bg-[color:var(--surface-2)] hover:text-foreground transition-colors"
      }
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const key = typeof children === "string" ? children : "";
  const color = SECTION_COLORS[key] ?? "var(--text-subtle)";
  return (
    <div
      className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
      style={{ color }}
    >
      {children}
    </div>
  );
}

// Alle Nav-Hrefs flach — damit `istAktiv` erkennen kann, ob ein spezifischerer
// (längerer) Eintrag denselben Pfad besser abdeckt (z. B. „Häufige Empfänger"
// unter „Klassifizierung"). So leuchtet immer nur der präziseste Eintrag.
const ALLE_HREFS = NAV_SEKTIONEN.flatMap((s) => s.eintraege.map((e) => e.href));

export function AppSidebar() {
  const pathname = usePathname();
  const istAktiv = (href: string) => {
    const passt = pathname === href || pathname.startsWith(href + "/");
    if (!passt) return false;
    // Ein längerer, ebenfalls passender Eintrag gewinnt (präziser).
    const praeziser = ALLE_HREFS.some(
      (h) =>
        h.length > href.length &&
        (pathname === h || pathname.startsWith(h + "/")),
    );
    return !praeziser;
  };

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r p-3 md:flex"
      style={{ background: "var(--surface-sunk)", borderColor: "var(--line)" }}
    >
      {/* Markenkopf — iOS-typisch: gerundete Quadrat-App-Icon */}
      <div className="mb-5 flex items-center gap-2.5 px-2 pt-1">
        <div
          className="grid h-[32px] w-[32px] place-items-center rounded-[8px] font-display text-[16px] font-bold leading-none tracking-[-0.02em]"
          style={{
            background: "var(--accent-color)",
            color: "var(--accent-fg)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.10)",
          }}
        >
          S
        </div>
        <div className="min-w-0">
          <div className="font-display text-[15px] font-bold leading-none tracking-[-0.015em]">
            Steueragent
          </div>
          <div className="mt-1 text-[11px] font-medium text-[color:var(--text-subtle)]">
            Autonome Buchhaltung
          </div>
        </div>
      </div>

      {/* Navigation — vier Bereiche mit Editorial-Eyebrows.
          Großer Abstand zwischen den Blöcken (space-y-7), Einträge
          innerhalb eines Blocks eng beieinander (space-y-0.5). */}
      <nav className="flex-1 space-y-7 overflow-y-auto px-0">
        {NAV_SEKTIONEN.map((sektion) => (
          <div key={sektion.titel} className="space-y-0.5">
            <SectionTitle>{sektion.titel}</SectionTitle>
            {sektion.eintraege.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={istAktiv(item.href)}
              />
            ))}
          </div>
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
