import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { bildProxyUrl } from "@/lib/bild-url";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { SortableBereicheList } from "./sortable-list";

export const dynamic = "force-dynamic";

export default async function BereichePage() {
  const supabase = await createClient();
  const { data: bereiche } = await supabase
    .from("bereiche").select("*").order("sortierung", { ascending: true }).limit(500);

  const ids = (bereiche ?? []).map((b) => b.id);
  const { data: katStats } = ids.length
    ? await supabase.from("kategorien").select("bereich_id").in("bereich_id", ids).limit(5000)
    : { data: [] };
  const { data: prodStats } = ids.length
    ? await supabase.from("produkte").select("bereich_id").in("bereich_id", ids).limit(5000)
    : { data: [] };

  const katCount = new Map<string, number>();
  for (const r of katStats ?? []) katCount.set(r.bereich_id, (katCount.get(r.bereich_id) ?? 0) + 1);
  const prodCount = new Map<string, number>();
  for (const r of prodStats ?? []) prodCount.set(r.bereich_id, (prodCount.get(r.bereich_id) ?? 0) + 1);

  const withUrls = (bereiche ?? []).map((b) => ({
    ...b,
    bild_url: bildProxyUrl("produktbilder", b.bild_path),
  }));

  const items = withUrls.map((b) => ({
    id: b.id,
    name: b.name,
    beschreibung: b.beschreibung,
    farbe: b.farbe,
    startseite: b.startseite,
    bild_url: b.bild_url,
    katCount: katCount.get(b.id) ?? 0,
    prodCount: prodCount.get(b.id) ?? 0,
  }));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Katalogstruktur"
        title="Bereiche"
        subtitle={`${items.length} Hauptkategorien`}
      >
        <Button asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Link href="/bereiche/neu">
            <Plus className="mr-2 h-4 w-4" /> Neuer Bereich
          </Link>
        </Button>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Keine Bereiche vorhanden"
          description="Legen Sie Ihren ersten Bereich an, um die Katalogstruktur aufzubauen."
          actionLabel="Bereich anlegen"
          actionHref="/bereiche/neu"
        />
      ) : (
        <SortableBereicheList initialItems={items} />
      )}
    </AppShell>
  );
}
