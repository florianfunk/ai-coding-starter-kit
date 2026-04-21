"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Layers,
  Package,
  Sparkles,
  LayoutTemplate,
  FileDown,
  Settings,
  History,
  HelpCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; description?: string };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Katalog",
    items: [
      { href: "/bereiche", label: "Bereiche", icon: LayoutGrid, description: "Produktbereiche verwalten" },
      { href: "/kategorien", label: "Kategorien", icon: Layers, description: "Kategorien pflegen" },
      { href: "/produkte", label: "Produkte", icon: Package, description: "Artikel & Datenblätter" },
    ],
  },
  {
    label: "Gestaltung",
    items: [
      { href: "/icons", label: "Icons", icon: Sparkles, description: "Icon-Bibliothek" },
      { href: "/datenblatt-vorlagen", label: "Vorlagen", icon: LayoutTemplate, description: "Datenblatt-Layouts" },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      { href: "/benutzer", label: "Benutzer", icon: Users, description: "Nutzer & Zugänge" },
      { href: "/einstellungen", label: "Einstellungen", icon: Settings, description: "Filialen & Katalog-Optionen" },
      { href: "/aktivitaet", label: "Aktivität", icon: History, description: "Änderungsprotokoll" },
    ],
  },
];

const directLinks: NavItem[] = [
  { href: "/export/katalog", label: "Export", icon: FileDown },
  { href: "/hilfe", label: "Hilfe", icon: HelpCircle },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupHasActive(pathname: string, group: NavGroup) {
  return group.items.some((item) => isActive(pathname, item.href));
}

const triggerClass = cn(
  navigationMenuTriggerStyle(),
  "bg-transparent text-white/80 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white data-[active]:bg-accent data-[active]:text-accent-foreground data-[state=open]:bg-white/10 data-[state=open]:text-white",
);

const directLinkClass = (active: boolean) =>
  cn(
    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
    active ? "bg-accent text-accent-foreground shadow-sm" : "text-white/80 hover:text-white hover:bg-white/10",
  );

export function MainNav() {
  const pathname = usePathname();

  return (
    <NavigationMenu className="max-w-none flex-1 justify-start">
      <NavigationMenuList className="justify-start space-x-1">
        {groups.map((group) => {
          const active = groupHasActive(pathname, group);
          return (
            <NavigationMenuItem key={group.label}>
              <NavigationMenuTrigger className={triggerClass} data-active={active ? "" : undefined}>
                {group.label}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[320px] gap-1 p-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const itemActive = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-start gap-3 rounded-md p-3 text-sm outline-none transition-colors",
                            itemActive
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-muted focus:bg-muted",
                          )}
                        >
                          <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-medium leading-none">{item.label}</span>
                            {item.description && (
                              <span
                                className={cn(
                                  "mt-1 text-xs leading-snug",
                                  itemActive ? "text-accent-foreground/80" : "text-muted-foreground",
                                )}
                              >
                                {item.description}
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          );
        })}

        {directLinks.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <NavigationMenuItem key={item.href}>
              <Link href={item.href} className={directLinkClass(active)}>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
