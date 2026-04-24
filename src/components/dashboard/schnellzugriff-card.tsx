import Link from "next/link";
import { Plus, Download, Euro, Upload, Zap, type LucideIcon } from "lucide-react";

type Action = {
  label: string;
  sub: string;
  icon: LucideIcon;
  bg: string;
  fg: string;
  iconBg: string;
  border?: string;
  href: string;
};

const actions: Action[] = [
  {
    label: "Produkt anlegen",
    sub: "Neu",
    icon: Plus,
    bg: "#D90416",
    fg: "#FFFFFF",
    iconBg: "rgba(255,255,255,0.18)",
    href: "/produkte/neu",
  },
  {
    label: "Katalog exportieren",
    sub: "PDF · XLSX",
    icon: Download,
    bg: "#193073",
    fg: "#FFFFFF",
    iconBg: "rgba(255,255,255,0.16)",
    href: "/export/katalog",
  },
  {
    label: "Bulk Preis-Update",
    sub: "Import",
    icon: Euro,
    bg: "#FFC10D",
    fg: "#1A1408",
    iconBg: "rgba(26,20,8,0.12)",
    href: "/produkte/import",
  },
  {
    label: "Bilder hochladen",
    sub: "Drag & Drop",
    icon: Upload,
    bg: "#FFFFFF",
    fg: "#193073",
    iconBg: "rgba(25,48,115,0.10)",
    border: "1px solid #E4E6EC",
    href: "/produkte",
  },
];

export function SchnellzugriffCard() {
  return (
    <div className="glass-card">
      <div className="card-head">
        <div className="card-head-icon">
          <Zap className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="card-head-title">Schnellzugriff</h3>
          <div className="card-head-sub">Aktionen</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              href={a.href}
              className="relative flex min-h-[96px] flex-col justify-between overflow-hidden rounded-[18px] p-[18px] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ background: a.bg, color: a.fg, border: a.border }}
            >
              <div
                className="grid h-[30px] w-[30px] place-items-center rounded-[9px]"
                style={{ background: a.iconBg, color: a.fg }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-semibold tracking-[-0.01em]">{a.label}</div>
                <div className="mt-0.5 text-[11px] opacity-72">{a.sub}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
