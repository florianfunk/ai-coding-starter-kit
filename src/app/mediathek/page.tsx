import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ChevronRight, Image as ImageIcon, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listMediathek } from "./actions";
import { MediathekGrid } from "./mediathek-grid";

export const dynamic = "force-dynamic";

export default async function MediathekPage() {
  // Initial-Listing — der Client lädt bei Filter-Änderung neu via Server-Action
  const items = await listMediathek({});
  const totalUsed = items.filter((i) => i.usageCount > 0).length;
  const totalUnused = items.length - totalUsed;
  const totalSizeBytes = items.reduce((acc, i) => acc + (i.size ?? 0), 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div>
          <div className="crumbs">
            <Link href="/">Dashboard</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Mediathek</span>
          </div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display-lg">Mediathek</h1>
              <p className="mt-2 max-w-[560px] text-[15px] text-muted-foreground">
                Zentrale Übersicht aller hochgeladenen Bilder. Suchen, filtern, in andere Slots
                übertragen oder ungenutzte Bilder löschen.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/mediathek/dubletten">
                <FileSearch className="h-4 w-4" /> Dubletten finden
              </Link>
            </Button>
          </div>
        </div>

        <SummaryStrip
          total={items.length}
          used={totalUsed}
          unused={totalUnused}
          totalSize={totalSizeBytes}
        />

        <MediathekGrid initialItems={items} />
      </div>
    </AppShell>
  );
}

function SummaryStrip({
  total,
  used,
  unused,
  totalSize,
}: {
  total: number;
  used: number;
  unused: number;
  totalSize: number;
}) {
  const tiles = [
    { label: "Bilder gesamt", value: total.toString(), sub: "im Bucket produktbilder", varName: "--primary" },
    { label: "Verwendet", value: used.toString(), sub: `${total > 0 ? Math.round((used / total) * 100) : 0}%`, varName: "--green" },
    { label: "Unbenutzt", value: unused.toString(), sub: "Kandidaten für Aufräumen", varName: "--warning" },
    { label: "Speicher", value: formatBytes(totalSize), sub: "ungefähr (sichtbare Bilder)", varName: "--violet" },
  ];
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="glass-card flex items-center gap-3.5 p-[18px]">
          <div
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl"
            style={{
              background: `hsl(var(${t.varName}) / 0.14)`,
              color: `hsl(var(${t.varName}))`,
            }}
          >
            <ImageIcon className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="eyebrow mb-0.5 !text-[10px]">{t.label}</div>
            <div className="text-[26px] font-semibold leading-none tracking-[-0.022em]">{t.value}</div>
            <div className="mt-1 text-[11.5px] text-muted-foreground">{t.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}
