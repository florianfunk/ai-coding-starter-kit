import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground/60">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mb-1 text-[16px] font-semibold tracking-[-0.012em]">{title}</h3>
      <p className="mb-6 max-w-sm text-[13.5px] text-muted-foreground">{description}</p>
      {actionLabel && actionHref && (
        <Button asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
