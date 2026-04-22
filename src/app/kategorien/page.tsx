import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { bildProxyUrl } from "@/lib/bild-url";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, Layers, Package, Filter } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { SortableKategorienList } from "./sortable-list";

export const dynamic = "force-dynamic";

export default async function KategorienPage({
  searchParams,
}: {
  searchParams: Promise<{ bereich?: string }>;
}) {
  const { bereich } = await searchParams;
  const supabase = await createClient();

  const { data: bereiche } = await supabase
    .from("bereiche")
    .select("id,name,farbe")
    .order("sortierung");

  let q = supabase.from("kategorien").select("*").order("sortierung").limit(1000);
  if (bereich) q = q.eq("bereich_id", bereich);
  const { data: kategorien } = await q;

  const ids = (kategorien ?? []).map((k) => k.id);
  const { data: prodStats } = ids.length
    ? await supabase.from("produkte").select("kategorie_id").in("kategorie_id", ids).limit(5000)
    : { data: [] };
  const prodCount = new Map<string, number>();
  for (const r of prodStats ?? []) prodCount.set(r.kategorie_id, (prodCount.get(r.kategorie_id) ?? 0) + 1);

  const { data: iconLinks } = ids.length
    ? await supabase.from("kategorie_icons").select("kategorie_id, icons(label)").in("kategorie_id", ids)
    : { data: [] };
  const iconsByKat = new Map<string, string[]>();
  for (const r of (iconLinks ?? []) as unknown as Array<{ kategorie_id: string; icons: { label: string } | null }>) {
    const arr = iconsByKat.get(r.kategorie_id) ?? [];
    if (r.icons?.label) arr.push(r.icons.label);
    iconsByKat.set(r.kategorie_id, arr);
  }

  const bereichInfo = new Map(
    (bereiche ?? []).map((b) => [b.id, { name: b.name, farbe: b.farbe as string | null }]),
  );

  const items = (kategorien ?? []).map((k) => {
    const info = bereichInfo.get(k.bereich_id);
    return {
      id: k.id,
      name: k.name,
      bereich_id: k.bereich_id,
      bereichName: info?.name ?? "—",
      bereichFarbe: info?.farbe ?? null,
      thumbnail_url: bildProxyUrl(
        "produktbilder",
        k.bild1_path ?? k.bild2_path ?? k.bild3_path ?? k.bild4_path,
      ),
      prodCount: prodCount.get(k.id) ?? 0,
      icons: iconsByKat.get(k.id) ?? [],
    };
  });

  const totalProdukte = items.reduce((a, b) => a + b.prodCount, 0);
  const uniqueBereiche = new Set(items.map((i) => i.bereich_id)).size;

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div>
          <div className="crumbs">
            <Link href="/">Dashboard</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/bereiche">Katalog</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Kategorien</span>
          </div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display-lg">Kategorien</h1>
              <p className="mt-2 max-w-[560px] text-[15px] text-muted-foreground">
                Die zweite Katalogebene. Jede Kategorie gehört zu einem Bereich, bündelt Produkte
                mit gemeinsamen Eigenschaften und steuert Datenblatt-Vorlagen sowie Filter-Tags.
              </p>
            </div>
            <Button asChild size="sm" className="shadow-sm">
              <Link href={`/kategorien/neu${bereich ? `?bereich=${bereich}` : ""}`}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Neue Kategorie
              </Link>
            </Button>
          </div>
        </div>

        <SummaryStrip
          kategorien={items.length}
          produkte={totalProdukte}
          bereicheN={uniqueBereiche}
        />

        <form className="toolbar">
          <Filter className="h-[15px] w-[15px] text-muted-foreground" />
          <label htmlFor="bereich" className="text-[13px] text-muted-foreground">
            Bereich:
          </label>
          <select
            id="bereich"
            name="bereich"
            defaultValue={bereich ?? ""}
            className="chip !h-8 min-w-[160px] !bg-muted pr-7"
          >
            <option value="">Alle Bereiche</option>
            {(bereiche ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline">
            Anwenden
          </Button>
          {bereich && (
            <Button asChild type="button" variant="ghost" size="sm">
              <Link href="/kategorien">Zurücksetzen</Link>
            </Button>
          )}
        </form>

        {items.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Keine Kategorien"
            description="Erstellen Sie eine Kategorie, um Produkte thematisch zu gruppieren."
            actionLabel="Kategorie anlegen"
            actionHref={`/kategorien/neu${bereich ? `?bereich=${bereich}` : ""}`}
          />
        ) : (
          <SortableKategorienList initialItems={items} />
        )}
      </div>
    </AppShell>
  );
}

function SummaryStrip({
  kategorien,
  produkte,
  bereicheN,
}: {
  kategorien: number;
  produkte: number;
  bereicheN: number;
}) {
  const tiles = [
    { label: "Kategorien", value: kategorien, sub: `über ${bereicheN} Bereiche`, icon: Layers, varName: "--primary" },
    { label: "Produkte", value: produkte, sub: "zugeordnet", icon: Package, varName: "--green" },
    {
      label: "Ø pro Bereich",
      value: bereicheN ? Math.round(kategorien / bereicheN) : 0,
      sub: "Kategorien",
      icon: Filter,
      varName: "--warning",
    },
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
