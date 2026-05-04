import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Plus, Info, Palette, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { IconsTable } from "./icons-table";

export const dynamic = "force-dynamic";

export default async function IconsPage() {
  const supabase = await createClient();
  const { data: icons } = await supabase
    .from("icons")
    .select("*")
    .order("gruppe", { ascending: true, nullsFirst: false })
    .order("sortierung")
    .order("label");

  const withUrls = await Promise.all(
    (icons ?? []).map(async (ic) => ({
      ...ic,
      url: await getSignedUrl("produktbilder", ic.symbol_path),
    })),
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div>
          <div className="crumbs">
            <Link href="/">Dashboard</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Assets</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Icons</span>
          </div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display-lg">Icons</h1>
              <p className="mt-2 max-w-[560px] text-[15px] text-muted-foreground">
                {withUrls.length} Icons zur Auswahl für Kategorien und Produkte. Format: PNG/SVG/PDF in 240×240 Pixel mit 8 pt Rahmen.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/icons/neu">
                <Plus className="h-3.5 w-3.5" /> Neues Icon
              </Link>
            </Button>
          </div>
        </div>

        <div className="glass-card flex items-start gap-3 p-4 text-[13px]">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-primary/10 text-primary">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <strong className="font-semibold">Format:</strong> PNG, SVG oder PDF in{" "}
            <strong className="font-semibold">240×240 Pixel</strong> (Rahmen 8 pt). Icons werden in Kategorien und Produkten als Auswahl angezeigt.
          </div>
        </div>

        {withUrls.length === 0 ? (
          <EmptyState
            icon={Palette}
            title="Keine Icons"
            description="Laden Sie Icons hoch, um sie in Kategorien und Produkten zu verwenden."
            actionLabel="Icon anlegen"
            actionHref="/icons/neu"
          />
        ) : (
          <IconsTable
            icons={withUrls.map((ic) => ({
              id: ic.id,
              label: ic.label,
              gruppe: ic.gruppe,
              sortierung: ic.sortierung,
              url: ic.url,
              show_as_symbol: ic.show_as_symbol ?? false,
            }))}
          />
        )}
      </div>
    </AppShell>
  );
}
