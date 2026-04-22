import Link from "next/link";

export type BereichRank = {
  id: string;
  name: string;
  farbe: string | null;
  prodCount: number;
  katCount: number;
};

export function BereicheRankCard({ bereiche }: { bereiche: BereichRank[] }) {
  const sorted = [...bereiche].sort((a, b) => b.prodCount - a.prodCount).slice(0, 6);
  const max = sorted[0]?.prodCount || 1;

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between px-5 pt-[18px] pb-3">
        <div>
          <div className="eyebrow">Sortiment</div>
          <h3 className="display-sm mt-0.5">Bereiche nach Produkten</h3>
        </div>
      </div>
      <div className="p-2 pb-3">
        {sorted.map((b, i) => {
          const barColor = b.farbe || `hsl(${(i * 47) % 360},70%,55%)`;
          return (
            <Link key={b.id} href={`/bereiche/${b.id}`} className="list-row rounded-xl">
              <div
                className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-[10.5px] font-semibold text-white"
                style={{
                  background: b.farbe ?? `hsl(${(i * 47) % 360},70%,60%)`,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{b.name}</div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">
                  {b.katCount} Kategorien
                </div>
              </div>
              <div className="hidden w-[140px] md:block">
                <div className="prog" style={{ height: 5 }}>
                  <div
                    className="prog-fill"
                    style={{ width: `${(b.prodCount / max) * 100}%`, background: barColor }}
                  />
                </div>
              </div>
              <div className="min-w-[36px] text-right font-mono text-[13px] font-semibold tracking-[-0.01em]">
                {b.prodCount}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
