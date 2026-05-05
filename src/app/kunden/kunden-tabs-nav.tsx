"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "stammdaten", label: "Stammdaten" },
  { key: "auswahl", label: "Auswahl" },
  { key: "preise", label: "Preise" },
  { key: "druckhistorie", label: "Druckhistorie" },
] as const;

export function KundenTabsNav({ kundeId }: { kundeId: string }) {
  const pathname = usePathname();

  return (
    <div className="border-b">
      <nav className="-mb-px flex gap-1" aria-label="Kunden-Tabs">
        {TABS.map((t) => {
          const href = `/kunden/${kundeId}/${t.key}`;
          const active = pathname === href;
          return (
            <Link
              key={t.key}
              href={href}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-b-2 border-primary text-foreground"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
