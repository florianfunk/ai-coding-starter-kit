"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Layers,
  Package,
  Euro,
  Sparkles,
  LayoutTemplate,
  FileDown,
  Settings,
  Users,
  History,
  Image as ImageIcon,
  Home,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { id: string; href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Übersicht",
    items: [{ id: "dashboard", href: "/", label: "Dashboard", icon: Home }],
  },
  {
    label: "Katalog",
    items: [
      { id: "bereiche", href: "/bereiche", label: "Bereiche", icon: LayoutGrid },
      { id: "kategorien", href: "/kategorien", label: "Kategorien", icon: Layers },
      { id: "produkte", href: "/produkte", label: "Produkte", icon: Package },
    ],
  },
  {
    label: "Assets",
    items: [
      { id: "icons", href: "/icons", label: "Icons", icon: Sparkles },
      { id: "vorlagen", href: "/datenblatt-vorlagen", label: "Datenblatt-Vorlagen", icon: LayoutTemplate },
    ],
  },
  {
    label: "System",
    items: [
      { id: "export", href: "/export/katalog", label: "Export", icon: FileDown },
      { id: "benutzer", href: "/benutzer", label: "Benutzer", icon: Users },
      { id: "einstellungen", href: "/einstellungen", label: "Einstellungen", icon: Settings },
      { id: "aktivitaet", href: "/aktivitaet", label: "Aktivität", icon: History },
      { id: "hilfe", href: "/hilfe", label: "Hilfe", icon: HelpCircle },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="sticky top-[52px] hidden lg:flex shrink-0 flex-col gap-4 overflow-y-auto px-3 py-4"
      style={{ width: 236, height: "calc(100vh - 52px)" }}
    >
      {groups.map((g) => (
        <div key={g.label}>
          <div className="eyebrow px-2.5 pt-1 pb-2 text-[10.5px]">{g.label}</div>
          <div className="flex flex-col gap-0.5">
            {g.items.map((n) => {
              const active = isActive(pathname, n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{n.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
