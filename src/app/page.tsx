import { AppShell } from "@/components/app-shell";
import { LayoutGrid, Layers, Package, Euro } from "lucide-react";
import { getDashboardStats } from "@/lib/cache";
import { createClient } from "@/lib/supabase/server";
import { HeroCard } from "@/components/dashboard/hero-card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { AufgabenCard } from "@/components/dashboard/aufgaben-card";
import { VollstaendigkeitCard } from "@/components/dashboard/vollstaendigkeit-card";
import { SchnellzugriffCard } from "@/components/dashboard/schnellzugriff-card";
import { BereicheRankCard, type BereichRank } from "@/components/dashboard/bereiche-rank-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stats = await getDashboardStats();

  const bereicheCount = stats?.bereiche_count ?? 0;
  const kategorienCount = stats?.kategorien_count ?? 0;
  const produkteCount = stats?.produkte_count ?? 0;
  const preiseCount = stats?.preise_count ?? 0;
  const ohnePreisCount = stats?.ohne_preis_count ?? 0;
  const ohneBildCount = stats?.ohne_bild_count ?? 0;
  const unbearbeitetCount = stats?.unbearbeitet_count ?? 0;
  const avgCompleteness = stats?.avg_completeness ?? 0;
  const completePercent = stats?.complete_percent ?? 0;
  const needsAttentionCount = stats?.needs_attention_count ?? 0;

  // Bereich rank data for the "Bereiche nach Produkten" widget
  const supabase = await createClient();
  const { data: bereicheData } = await supabase
    .from("bereiche")
    .select("id, name, farbe")
    .order("sortierung")
    .limit(50);

  const bereichIds = (bereicheData ?? []).map((b) => b.id);
  const [{ data: katStats }, { data: prodStats }] = await Promise.all([
    bereichIds.length
      ? supabase.from("kategorien").select("bereich_id").in("bereich_id", bereichIds).limit(5000)
      : Promise.resolve({ data: [] as { bereich_id: string }[] }),
    bereichIds.length
      ? supabase.from("produkte").select("bereich_id").in("bereich_id", bereichIds).limit(5000)
      : Promise.resolve({ data: [] as { bereich_id: string }[] }),
  ]);
  const katCount = new Map<string, number>();
  for (const r of katStats ?? []) katCount.set(r.bereich_id, (katCount.get(r.bereich_id) ?? 0) + 1);
  const prodCount = new Map<string, number>();
  for (const r of prodStats ?? []) prodCount.set(r.bereich_id, (prodCount.get(r.bereich_id) ?? 0) + 1);

  const bereicheRank: BereichRank[] = (bereicheData ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    farbe: b.farbe,
    katCount: katCount.get(b.id) ?? 0,
    prodCount: prodCount.get(b.id) ?? 0,
  }));

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <HeroCard
          completeness={avgCompleteness}
          needsAttention={needsAttentionCount}
          doneToday={Math.max(0, produkteCount - unbearbeitetCount)}
          totalTodayTargets={produkteCount}
          exportsPlanned={3}
          exportsDone={2}
        />

        <div className="bento">
          <div className="b-3">
            <StatTile label="Bereiche" value={bereicheCount} icon={LayoutGrid} href="/bereiche" tone="red" />
          </div>
          <div className="b-3">
            <StatTile label="Kategorien" value={kategorienCount} icon={Layers} href="/kategorien" tone="red" />
          </div>
          <div className="b-3">
            <StatTile label="Produkte" value={produkteCount} icon={Package} href="/produkte" tone="navy" />
          </div>
          <div className="b-3">
            <StatTile label="Preise aktiv" value={preiseCount} icon={Euro} href="/produkte" tone="amber" />
          </div>
        </div>

        <div className="bento">
          <div className="b-5">
            <AufgabenCard
              ohnePreis={ohnePreisCount}
              ohneBild={ohneBildCount}
              unbearbeitet={unbearbeitetCount}
              needsAttention={needsAttentionCount}
            />
          </div>
          <div className="b-4">
            <VollstaendigkeitCard
              avg={avgCompleteness}
              completePercent={completePercent}
              total={produkteCount}
              needsAttention={needsAttentionCount}
            />
          </div>
          <div className="b-3">
            <SchnellzugriffCard />
          </div>
        </div>

        <div className="bento">
          <div className="b-12">
            <BereicheRankCard bereiche={bereicheRank} />
          </div>
        </div>

        <div className="mt-2 text-center text-[11px] tracking-[-0.003em] text-muted-foreground">
          Lichtstudio PIM · {new Date().getFullYear()}
        </div>
      </div>
    </AppShell>
  );
}
