import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <ShieldCheck className={cn("h-6 w-6 text-primary", iconClassName)} />
      <span>RiskGuard</span>
    </span>
  );
}
