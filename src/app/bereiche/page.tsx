import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { bildProxyUrl } from "@/lib/bild-url";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, Folders, Layers, Package, Upload, Download } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { SortableBereicheList } from "./sortable-list";

export const dynamic = "force-dynamic";

export default async function BereichePage() {
  const supabase = await createClient();
  const { data: bereiche } = await supabase
    .from("bereiche")
    .select("*")
    .order("sortierung", { ascending: true })
    .limit(500);

  const ids = (bereiche ?? []).map((b) => b.id);
  const { data: katStats } = ids.length
    ? await supabase.from("kategorien").select("bereich_id").in("bereich_id", ids).limit(5000)
    : { data: [] };
  const { data: prodStats } = ids.length
    ? await supabase.from("produkte").select("bereich_id").in("bereich_id", ids).limit(5000)
    : { data: [] };

  const katCount = new Map<string, number>();
  for (const r of katStats ?? []) katCount.set(r.bereich_id, (katCount.get(r.bereich_id) ?? 0) + 1);
  const prodCount = new Map<string, number>();
  for (const r of prodStats ?? []) prodCount.set(r.bereich_id, (prodCount.get(r.bereich_id) ?? 0) + 1);

  const withUrls = (bereiche ?? []).map((b) => ({
    ...b,
    bild_url: bildProxyUrl("produktbilder", b.bild_path),
  }));

  const items = withUrls.map((b) => ({
    id: b.id,
    name: b.name,
    beschreibung: b.beschreibung,
    farbe: b.farbe,
    startseite: b.startseite,
    bild_url: b.bild_url,
    katCount: katCount.get(b.id) ?? 0,
    prodCount: prodCount.get(b.id) ?? 0,
  }));

  const totalKategorien = items.reduce((a, b) => a + b.katCount, 0);
  const totalProdukte = items.reduce((a, b) => a + b.prodCount, 0);
  const avgKatPerBereich = items.length ? Math.round(totalKategorien / items.length) : 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div>
          <div className="crumbs">
            <Link href="/">Dashboard</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Katalog</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Bereiche</span>
          </div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display-lg">Bereiche</h1>
              <p className="mt-2 max-w-[560px] text-[15px] text-muted-foreground">
                Die oberste Ebene deines Katalogs. Jeder Bereich bündelt Kategorien und Produkte —
                und steuert Navigation, Export-Reihenfolge und Filialen-Sichtbarkeit.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/export/katalog">
                  <Download className="mr-1 h-3.5 w-3.5" /> Export
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/produkte/import">
                  <Upload className="mr-1 h-3.5 w-3.5" /> Import
                </Link>
              </Button>
              <Button asChild size="sm" className="shadow-sm">
                <Link href="/bereiche/neu">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Neuer Bereich
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <SummaryStrip
          bereiche={items.length}
          kategorien={totalKategorien}
          produkte={totalProdukte}
          avgKat={avgKatPerBereich}
        />

        {items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Keine Bereiche vorhanden"
            description="Legen Sie Ihren ersten Bereich an, um die Katalogstruktur aufzubauen."
            actionLabel="Bereich anlegen"
            actionHref="/bereiche/neu"
          />
        ) : (
          <SortableBereicheList initialItems={items} />
        )}
      </div>
    </AppShell>
  );
}

function SummaryStrip({
  bereiche,
  kategorien,
  produkte,
  avgKat,
}: {
  bereiche: number;
  kategorien: number;
  produkte: number;
  avgKat: number;
}) {
  const tiles = [
    { label: "Bereiche", value: bereiche, sub: `${bereiche} angelegt`, icon: Folders, varName: "--violet" },
    { label: "Kategorien", value: kategorien, sub: `Ø ${avgKat} pro Bereich`, icon: Layers, varName: "--primary" },
    { label: "Produkte", value: produkte, sub: "gesamt zugeordnet", icon: Package, varName: "--green" },
  ];
  return (
    <div className="grid gap-3.5 sm:grid-cols-3">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <div key={t.label} className="glass-card flex items-center gap-3.5 p-[18px]">
            <div
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl"
              style={{
                background: `hsl(var(${t.varName}) / 0.14)`,
                color: `hsl(var(${t.varName}))`,
              }}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="eyebrow mb-0.5 !text-[10px]">{t.label}</div>
              <div className="text-[26px] font-semibold leading-none tracking-[-0.022em]">{t.value}</div>
              <div className="mt-1 text-[11.5px] text-muted-foreground">{t.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
