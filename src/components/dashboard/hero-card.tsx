import { Search, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

type HeroProps = {
  completeness: number;
  needsAttention: number;
  doneToday: number;
  totalTodayTargets: number;
  exportsPlanned: number;
  exportsDone: number;
};

function AppleFitnessRings({
  outer,
  middle,
  inner,
}: {
  outer: number;
  middle: number;
  inner: number;
}) {
  const rings = [
    { r: 92, fraction: outer / 100, from: "#5ac8fa", to: "#007aff", id: "ringA" },
    { r: 72, fraction: middle, from: "#30d158", to: "#00c7be", id: "ringB" },
    { r: 52, fraction: inner, from: "#ffcc00", to: "#ff9f0a", id: "ringC" },
  ];
  return (
    <svg width={220} height={220} viewBox="0 0 220 220" className="-rotate-90 shrink-0">
      {rings.map((ring) => {
        const circumference = 2 * Math.PI * ring.r;
        return (
          <g key={ring.id}>
            <circle
              cx={110}
              cy={110}
              r={ring.r}
              fill="none"
              stroke={`url(#${ring.id}-track)`}
              strokeWidth={14}
            />
            <circle
              cx={110}
              cy={110}
              r={ring.r}
              fill="none"
              stroke={`url(#${ring.id})`}
              strokeWidth={14}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, ring.fraction)))}
              strokeLinecap="round"
            />
          </g>
        );
      })}
      <defs>
        {rings.map((r) => (
          <linearGradient id={r.id} x1="0" y1="0" x2="1" y2="1" key={r.id}>
            <stop offset="0%" stopColor={r.from} />
            <stop offset="100%" stopColor={r.to} />
          </linearGradient>
        ))}
        {rings.map((r) => (
          <linearGradient id={`${r.id}-track`} x1="0" y1="0" x2="1" y2="1" key={`${r.id}-t`}>
            <stop offset="0%" stopColor={r.from} stopOpacity={0.15} />
            <stop offset="100%" stopColor={r.to} stopOpacity={0.15} />
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}

function formatDate() {
  const d = new Date();
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Guten Morgen";
  if (hour < 17) return "Hallo";
  return "Guten Abend";
}

export function HeroCard({
  completeness,
  needsAttention,
  doneToday,
  totalTodayTargets,
  exportsPlanned,
  exportsDone,
}: HeroProps) {
  return (
    <div className="hero-surface relative overflow-hidden">
      <div className="hero-noise" />
      <div className="relative flex flex-wrap items-start justify-between gap-8">
        <div className="min-w-0 flex-1 basis-[420px]">
          <div className="eyebrow mb-2.5 flex items-center gap-2">
            <span className="inline-block h-[7px] w-[7px] rounded-full bg-success" />
            {formatDate()}
          </div>
          <h1 className="display-xl">{greeting()}.</h1>
          <p className="mt-3.5 max-w-[560px] text-[17px] leading-[1.45] text-muted-foreground">
            {needsAttention > 0
              ? `${needsAttention} Produkte brauchen deine Aufmerksamkeit.`
              : "Alle Produkte sind vollständig gepflegt."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/produkte/neu"
              className="inline-flex h-[36px] items-center gap-1.5 rounded-full bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-sm transition-all hover:bg-[hsl(var(--primary-hover))] hover:-translate-y-px"
            >
              <Plus className="h-3.5 w-3.5" />
              Neues Produkt
            </Link>
            <button
              type="button"
              className="inline-flex h-[36px] items-center gap-1.5 rounded-full bg-white/70 px-4 text-[13.5px] font-medium text-foreground shadow-sm backdrop-blur transition-all hover:bg-white dark:bg-white/10 dark:hover:bg-white/20"
            >
              <Search className="h-3.5 w-3.5" />
              Schnellsuche
              <kbd className="ml-1 font-mono text-[11px] text-muted-foreground">⌘K</kbd>
            </button>
            <Link
              href="/produkte?vollstaendigkeit=unvollstaendig"
              className="inline-flex h-[36px] items-center gap-1.5 rounded-full px-4 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Katalog prüfen
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="relative h-[220px] w-[220px] shrink-0">
          <AppleFitnessRings
            outer={completeness}
            middle={totalTodayTargets > 0 ? doneToday / totalTodayTargets : 0}
            inner={exportsPlanned > 0 ? exportsDone / exportsPlanned : 0}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="eyebrow mb-0.5">Heute</div>
            <div className="text-[36px] font-semibold leading-none tracking-[-0.03em]">
              {completeness}
            </div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">Vollständigkeit %</div>
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-5">
        <RingLegend
          from="#5ac8fa"
          to="#007aff"
          label="Datenqualität"
          value={`${completeness}%`}
        />
        <RingLegend
          from="#30d158"
          to="#00c7be"
          label="Erledigt heute"
          value={`${doneToday} / ${totalTodayTargets}`}
        />
        <RingLegend
          from="#ffcc00"
          to="#ff9f0a"
          label="Export-Plan"
          value={`${exportsDone} / ${exportsPlanned}`}
        />
      </div>
    </div>
  );
}

function RingLegend({ from, to, label, value }: { from: string; to: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="h-2.5 w-2.5 rounded-sm"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      />
      <div>
        <div className="font-mono text-[11px] text-muted-foreground">{label}</div>
        <div className="text-[14px] font-semibold tracking-[-0.01em]">{value}</div>
      </div>
    </div>
  );
}
