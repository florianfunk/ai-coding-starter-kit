import type { ReactNode } from "react";

export function PageHeader({
  title, subtitle, children, eyebrow,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-5 border-b mb-6">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-1">{eyebrow}</p>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 shrink-0">{children}</div>}
    </div>
  );
}
