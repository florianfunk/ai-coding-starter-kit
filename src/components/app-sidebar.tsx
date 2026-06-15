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

// Bereichs-Trennung mit klarem Workflow-Fokus:
//   Heute   — taeglich/woechentlich angefasste Ansichten
//   Buecher — Buchhaltung: Buchungen, Belege, Analyse
//   Steuer  — Steuer-Endprodukte
//   Setup   — Stammdaten + System-Konfiguration
const NAV_HEUTE = [
  { href: "/dashboard", label: "Dashboard" },
  // PROJ-17 — KI-Chat: prominenter Einstiegspunkt im Bereich "Heute",
  // weil die taegliche Interaktion mit dem Agenten ueber den Chat laeuft.
  { href: "/chat", label: "KI-Chat" },
  { href: "/pruefliste", label: "Prüfliste" },
  { href: "/merkliste", label: "Merkliste" },
  { href: "/kuendigungen", label: "Kündigungen" },
];

const NAV_BUECHER = [
  { href: "/buchungen", label: "Buchungen" },
  { href: "/kategorien-analyse", label: "Kategorien-Analyse" },
  { href: "/lieferanten-notizen", label: "Lieferanten-Notizen" },
  { href: "/abgleich", label: "Beleg-Abgleich" },
  { href: "/belege", label: "Belege" },
];

const NAV_STEUER = [
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

// Block-Reihenfolge der Sidebar. Titel + zugehörige Einträge werden je
// als eigener Container gerendert — so bleibt der Abstand zwischen den
// Blöcken groß, die Einträge innerhalb eines Blocks aber eng zusammen.
const NAV_SEKTIONEN = [
  { titel: "Heute", eintraege: NAV_HEUTE },
  { titel: "Bücher", eintraege: NAV_BUECHER },
  { titel: "Steuer", eintraege: NAV_STEUER },
  { titel: "Setup", eintraege: SETTINGS },
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
          ? "flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13.5px] font-semibold tracking-[-0.005em] bg-brand-violet text-white"
          : "flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13.5px] font-medium tracking-[-0.005em] text-foreground/75 hover:bg-[color:var(--surface-2)] hover:text-foreground transition-colors"
      }
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}

// Pro Bereich eine eigene Akzentfarbe — macht die Sidebar-Navigation auf
// einen Blick scanbar und greift die Marken-Palette aus globals.css auf.
const SECTION_COLORS: Record<string, string> = {
  Heute: "var(--brand-violet)",
  "Bücher": "var(--brand-cyan)",
  Steuer: "var(--brand-cerise)",
  Setup: "var(--brand-shaft)",
};

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

export function AppSidebar() {
  const pathname = usePathname();
  const istAktiv = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

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
