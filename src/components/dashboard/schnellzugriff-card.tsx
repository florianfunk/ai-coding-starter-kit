import Link from "next/link";
import { Plus, Download, Euro, Upload, type LucideIcon } from "lucide-react";

type Action = { label: string; sub: string; icon: LucideIcon; gradient: string; href: string };

const actions: Action[] = [
  { label: "Produkt anlegen", sub: "Neu", icon: Plus, gradient: "linear-gradient(135deg,#007aff,#5ac8fa)", href: "/produkte/neu" },
  { label: "Katalog exportieren", sub: "PDF", icon: Download, gradient: "linear-gradient(135deg,#af52de,#ff2d55)", href: "/export/katalog" },
  { label: "Bulk Preis-Update", sub: "Import", icon: Euro, gradient: "linear-gradient(135deg,#ff9f0a,#ff2d55)", href: "/produkte/import" },
  { label: "Bilder hochladen", sub: "Drag & Drop", icon: Upload, gradient: "linear-gradient(135deg,#30d158,#00c7be)", href: "/produkte" },
];

export function SchnellzugriffCard() {
  return (
    <div className="glass-card">
      <div className="px-5 pt-[18px] pb-3">
        <div className="eyebrow">Aktionen</div>
        <h3 className="display-sm mt-0.5">Schnellzugriff</h3>
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-5 pb-5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              href={a.href}
              className="card-hover relative flex min-h-[96px] flex-col justify-between overflow-hidden rounded-[18px] p-[18px] text-white shadow-sm"
              style={{ background: a.gradient }}
            >
              <div className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-white/20 backdrop-blur">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-semibold tracking-[-0.01em]">{a.label}</div>
                <div className="mt-0.5 text-[11px] opacity-80">{a.sub}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
