"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function NavLink({
  href, label, children,
}: {
  href: string; label: string; children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-accent text-accent-foreground shadow-sm"
          : "text-white/80 hover:text-white hover:bg-white/10",
      )}
    >
      {children}
      <span className="hidden lg:inline">{label}</span>
    </Link>
  );
}
