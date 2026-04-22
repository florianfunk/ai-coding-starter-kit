export function VollstaendigkeitCard({
  avg,
  completePercent,
  total,
  needsAttention,
}: {
  avg: number;
  completePercent: number;
  total: number;
  needsAttention: number;
}) {
  const complete = Math.round((completePercent / 100) * total);
  const attention = needsAttention;
  const partial = Math.max(0, total - complete - attention);

  const segments = [
    { label: "Vollständig", count: complete, color: "hsl(var(--green))" },
    { label: "Teilweise", count: partial, color: "hsl(var(--warning))" },
    { label: "Lückenhaft", count: attention, color: "hsl(var(--destructive))" },
  ];

  const totalAll = Math.max(1, complete + partial + attention);
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - avg / 100);

  return (
    <div className="glass-card">
      <div className="px-5 pt-[18px] pb-3">
        <div className="eyebrow">Datenqualität</div>
        <h3 className="display-sm mt-0.5">Vollständigkeit</h3>
      </div>
      <div className="flex items-center gap-[18px] px-5 pb-[18px]">
        <div className="relative h-[108px] w-[108px] shrink-0">
          <svg width={108} height={108} viewBox="0 0 108 108" className="-rotate-90">
            <circle cx={54} cy={54} r={r} stroke="hsl(var(--hairline))" strokeWidth={8} fill="none" />
            <circle
              cx={54}
              cy={54}
              r={r}
              stroke="url(#vollGradient)"
              strokeWidth={8}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="vollGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#30d158" />
                <stop offset="100%" stopColor="#007aff" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[30px] font-semibold leading-none tracking-[-0.025em]">
              {avg}
              <span className="text-[14px] text-muted-foreground">%</span>
            </div>
            <div className="eyebrow mt-0.5 !text-[9px]">gepflegt</div>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {segments.map((s) => {
            const pct = (s.count / totalAll) * 100;
            return (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: s.color }} />
                    <span className="text-foreground/80">{s.label}</span>
                  </span>
                  <span className="font-mono text-muted-foreground">{s.count}</span>
                </div>
                <div className="prog">
                  <div className="prog-fill" style={{ width: `${pct}%`, background: s.color, opacity: 0.85 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
