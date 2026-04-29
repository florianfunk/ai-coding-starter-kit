import { AppShell } from "@/components/app-shell";
import { LayoutGrid, Layers, Package, Euro } from "lucide-react";
import { getDashboardStats, getBereiche, getBereichCounts } from "@/lib/cache";
import { HeroCard } from "@/components/dashboard/hero-card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { AufgabenCard } from "@/components/dashboard/aufgaben-card";
import { VollstaendigkeitCard } from "@/components/dashboard/vollstaendigkeit-card";
import { SchnellzugriffCard } from "@/components/dashboard/schnellzugriff-card";
import { BereicheRankCard, type BereichRank } from "@/components/dashboard/bereiche-rank-card";

export default async function HomePage() {
  // Alle Daten aus dem Cache — keine direkten DB-Queries mehr im Render-Pfad.
  const [stats, bereicheData, counts] = await Promise.all([
    getDashboardStats(),
    getBereiche(),
    getBereichCounts(),
  ]);

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

  const countsMap = new Map(counts.map((c) => [c.bereich_id, c]));
  const bereicheRank: BereichRank[] = bereicheData.slice(0, 50).map((b) => {
    const c = countsMap.get(b.id);
    return {
      id: b.id,
      name: b.name,
      farbe: b.farbe,
      katCount: c?.kategorien_count ?? 0,
      prodCount: c?.produkte_count ?? 0,
    };
  });

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
