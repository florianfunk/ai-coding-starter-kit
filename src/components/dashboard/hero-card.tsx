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

// Brand V2 ring colours: navy → red (outer), navy (middle), amber (inner)
function FitnessRings({
  outer,
  middle,
  inner,
}: {
  outer: number;
  middle: number;
  inner: number;
}) {
  const rings = [
    { r: 92, fraction: outer / 100, from: "#193073", to: "#D90416", id: "ringA", track: "rgba(255,255,255,0.18)" },
    { r: 72, fraction: middle, from: "#193073", to: "#24428f", id: "ringB", track: "rgba(255,255,255,0.15)" },
    { r: 52, fraction: inner, from: "#FFC10D", to: "#FFC10D", id: "ringC", track: "rgba(255,255,255,0.15)" },
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
              stroke={ring.track}
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
      <div className="relative flex flex-wrap items-start justify-between gap-8">
        <div className="min-w-0 flex-1 basis-[420px]">
          <div className="eyebrow mb-2.5 flex items-center gap-2">
            <span className="inline-block h-[7px] w-[7px] rounded-full bg-[#FFC10D]" />
            {formatDate()}
          </div>
          <h1 className="display-xl">{greeting()}.</h1>
          <p className="mt-3.5 max-w-[560px] text-[17px] leading-[1.45]">
            {needsAttention > 0
              ? `${needsAttention} Produkte brauchen deine Aufmerksamkeit.`
              : "Alle Produkte sind vollständig gepflegt."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/produkte/neu"
              className="inline-flex h-[36px] items-center gap-1.5 rounded-full px-4 text-[13.5px] font-medium text-white shadow-sm transition-all hover:-translate-y-px"
              style={{
                background: "#D90416",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08), inset 0 0.5px 0 rgba(255,255,255,0.2)",
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Neues Produkt
            </Link>
            <button
              type="button"
              className="inline-flex h-[36px] items-center gap-1.5 rounded-full border border-white/22 bg-white/14 px-4 text-[13.5px] font-medium text-white transition-all hover:bg-white/22"
            >
              <Search className="h-3.5 w-3.5" />
              Schnellsuche
              <kbd className="ml-1 rounded border border-white/22 bg-white/14 px-1.5 py-0.5 font-mono text-[11px] text-white">
                ⌘K
              </kbd>
            </button>
            <Link
              href="/produkte?vollstaendigkeit=unvollstaendig"
              className="inline-flex h-[36px] items-center gap-1.5 rounded-full border border-white/22 bg-white/12 px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-white/20"
            >
              Katalog prüfen
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="relative h-[220px] w-[220px] shrink-0">
          <FitnessRings
            outer={completeness}
            middle={totalTodayTargets > 0 ? doneToday / totalTodayTargets : 0}
            inner={exportsPlanned > 0 ? exportsDone / exportsPlanned : 0}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="eyebrow mb-0.5">Heute</div>
            <div className="text-[36px] font-semibold leading-none tracking-[-0.03em] text-white">
              {completeness}
            </div>
            <div className="mt-0.5 text-[12px] text-white/78">Vollständigkeit %</div>
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-5">
        <RingLegend color="#D90416" label="Datenqualität" value={`${completeness}%`} />
        <RingLegend
          color="#24428f"
          label="Erledigt heute"
          value={`${doneToday} / ${totalTodayTargets}`}
        />
        <RingLegend
          color="#FFC10D"
          label="Export-Plan"
          value={`${exportsDone} / ${exportsPlanned}`}
        />
      </div>
    </div>
  );
}

function RingLegend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      <div>
        <div className="font-mono text-[11px] text-white/60">{label}</div>
        <div className="text-[14px] font-semibold tracking-[-0.01em] text-white">{value}</div>
      </div>
    </div>
  );
}
