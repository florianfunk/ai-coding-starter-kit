import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ChevronRight } from "lucide-react";
import { DublettenAnalyzer } from "./dubletten-analyzer";

export const dynamic = "force-dynamic";

export default function DublettenPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div>
          <div className="crumbs">
            <Link href="/">Dashboard</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/mediathek">Mediathek</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Dubletten</span>
          </div>
          <h1 className="display-lg mt-3">Dubletten-Analyse</h1>
          <p className="mt-2 max-w-[640px] text-[15px] text-muted-foreground">
            Findet byte-genaue Dubletten im Storage über SHA-256-Hashes. Zeigt
            Master-Vorschlag und betroffene DB-Referenzen — schreibt nichts.
          </p>
        </div>

        <DublettenAnalyzer />
      </div>
    </AppShell>
  );
}
