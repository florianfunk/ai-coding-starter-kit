import {
  Home,
  LayoutGrid,
  Layers,
  Package,
  Library,
  Sparkles,
  LayoutTemplate,
  FileDown,
  Users,
  History,
  Tag,
  TrendingDown,
  Settings,
  User as UserIcon,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceId = "start" | "loesungen" | "kunden" | "einstellungen";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type SidebarNavGroup = {
  label: string;
  items: SidebarNavItem[];
};

export type Workspace = {
  id: WorkspaceId;
  label: string;
  icon: LucideIcon;
  landingPath: string;
  matchPrefixes: string[];
  sidebar: SidebarNavGroup[];
  showSuggestionCard?: boolean;
};

export const WORKSPACES: Workspace[] = [
  {
    id: "start",
    label: "Start",
    icon: Home,
    landingPath: "/",
    matchPrefixes: [],
    sidebar: [
      {
        label: "Übersicht",
        items: [{ href: "/", label: "Dashboard", icon: Home }],
      },
    ],
  },
  {
    id: "loesungen",
    label: "Lösungen",
    icon: Layers,
    landingPath: "/bereiche",
    matchPrefixes: [
      "/bereiche",
      "/kategorien",
      "/produkte",
      "/mediathek",
      "/icons",
      "/datenblatt-vorlagen",
      "/export",
    ],
    showSuggestionCard: true,
    sidebar: [
      {
        label: "Katalog",
        items: [
          { href: "/bereiche", label: "Bereiche", icon: LayoutGrid },
          { href: "/kategorien", label: "Kategorien", icon: Layers },
          { href: "/produkte", label: "Produkte", icon: Package },
        ],
      },
      {
        label: "Assets",
        items: [
          { href: "/mediathek", label: "Mediathek", icon: Library },
          { href: "/icons", label: "Icons", icon: Sparkles },
          { href: "/datenblatt-vorlagen", label: "Datenblatt-Vorlagen", icon: LayoutTemplate },
        ],
      },
      {
        label: "Druck",
        items: [{ href: "/export/katalog", label: "Druckhistorie (alle)", icon: FileDown }],
      },
    ],
  },
  {
    id: "kunden",
    label: "Kunden",
    icon: Users,
    landingPath: "/kunden",
    matchPrefixes: ["/kunden"],
    sidebar: [
      {
        label: "Kunden",
        items: [
          { href: "/kunden", label: "Kundenliste", icon: Users },
          { href: "/kunden/druckhistorie", label: "Druckhistorie (Kunden)", icon: History },
          { href: "/kunden/sonderpreise", label: "Sonderpreise", icon: TrendingDown },
        ],
      },
      {
        label: "Stammdaten",
        items: [{ href: "/kunden/branchen", label: "Branchen", icon: Tag }],
      },
    ],
  },
  {
    id: "einstellungen",
    label: "Einstellungen",
    icon: Settings,
    landingPath: "/einstellungen",
    matchPrefixes: ["/einstellungen", "/benutzer", "/aktivitaet", "/hilfe"],
    sidebar: [
      {
        label: "Konto",
        items: [
          { href: "/benutzer/profil", label: "Mein Profil", icon: UserIcon },
          { href: "/benutzer", label: "Benutzer", icon: Users },
        ],
      },
      {
        label: "System",
        items: [
          { href: "/einstellungen", label: "Filialen & Katalog", icon: Settings },
          { href: "/aktivitaet", label: "Aktivität", icon: History },
        ],
      },
      {
        label: "Hilfe",
        items: [{ href: "/hilfe", label: "Hilfe & FAQ", icon: HelpCircle }],
      },
    ],
  },
];

export const DEFAULT_WORKSPACE_ID: WorkspaceId = "start";

export function getWorkspaceForPath(pathname: string): Workspace {
  if (pathname === "/" || pathname === "") {
    return WORKSPACES[0];
  }

  for (const ws of WORKSPACES) {
    if (ws.id === "start") continue;
    for (const prefix of ws.matchPrefixes) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        return ws;
      }
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(`[workspace] No workspace match for path "${pathname}", falling back to "start"`);
  }
  return WORKSPACES[0];
}

export function getWorkspaceById(id: WorkspaceId): Workspace {
  const ws = WORKSPACES.find((w) => w.id === id);
  if (!ws) throw new Error(`Unknown workspace id: ${id}`);
  return ws;
}
