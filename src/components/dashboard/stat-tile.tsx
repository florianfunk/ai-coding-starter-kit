import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type StatTileProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
  colorVar: "primary" | "violet" | "green" | "warning" | "pink" | "teal";
};

const COLOR_MAP: Record<StatTileProps["colorVar"], { fg: string; soft: string }> = {
  primary: { fg: "hsl(var(--primary))", soft: "hsl(var(--primary) / 0.12)" },
  violet: { fg: "hsl(var(--violet))", soft: "hsl(var(--violet) / 0.12)" },
  green: { fg: "hsl(var(--green))", soft: "hsl(var(--green) / 0.12)" },
  warning: { fg: "hsl(var(--warning))", soft: "hsl(var(--warning) / 0.14)" },
  pink: { fg: "hsl(var(--pink))", soft: "hsl(var(--pink) / 0.12)" },
  teal: { fg: "hsl(var(--teal))", soft: "hsl(var(--teal) / 0.12)" },
};

export function StatTile({ label, value, icon: Icon, href, colorVar }: StatTileProps) {
  const c = COLOR_MAP[colorVar];
  return (
    <Link
      href={href}
      className="glass-card card-hover group relative flex min-h-[146px] flex-col justify-between p-[22px] text-left"
    >
      <div className="flex items-start justify-between">
        <div className="eyebrow">{label}</div>
        <div
          className="grid h-8 w-8 place-items-center rounded-[10px]"
          style={{ background: c.soft, color: c.fg }}
        >
          <Icon className="h-[15px] w-[15px]" />
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="mega-number">{value}</span>
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-2 text-[12px] text-muted-foreground">
          <span>Gesamt</span>
        </div>
      </div>
    </Link>
  );
}
