import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type BrandTone = "red" | "navy" | "amber";

export type StatTileProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
  tone: BrandTone;
};

const TONE_MAP: Record<BrandTone, { fg: string; soft: string }> = {
  red: { fg: "#D90416", soft: "rgba(217, 4, 22, 0.12)" },
  navy: { fg: "#193073", soft: "rgba(25, 48, 115, 0.12)" },
  amber: { fg: "#B88700", soft: "rgba(255, 193, 13, 0.2)" },
};

export function StatTile({ label, value, icon: Icon, href, tone }: StatTileProps) {
  const c = TONE_MAP[tone];
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
