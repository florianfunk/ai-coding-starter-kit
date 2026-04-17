import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Plus, Layers, Filter } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { SortableKategorienList } from "./sortable-list";

export const dynamic = "force-dynamic";

export default async function KategorienPage({
  searchParams,
}: {
  searchParams: Promise<{ bereich?: string }>;
}) {
  const { bereich } = await searchParams;
  const supabase = await createClient();

  const { data: bereiche } = await supabase.from("bereiche").select("id,name").order("sortierung");

  let q = supabase.from("kategorien").select("*").order("sortierung").limit(1000);
  if (bereich) q = q.eq("bereich_id", bereich);
  const { data: kategorien } = await q;

  const ids = (kategorien ?? []).map((k) => k.id);
  const { data: prodStats } = ids.length
    ? await supabase.from("produkte").select("kategorie_id").in("kategorie_id", ids).limit(5000)
    : { data: [] };
  const prodCount = new Map<string, number>();
  for (const r of prodStats ?? []) prodCount.set(r.kategorie_id, (prodCount.get(r.kategorie_id) ?? 0) + 1);

  const { data: iconLinks } = ids.length
    ? await supabase.from("kategorie_icons").select("kategorie_id, icons(label)").in("kategorie_id", ids)
    : { data: [] };
  const iconsByKat = new Map<string, string[]>();
  for (const r of (iconLinks ?? []) as any[]) {
    const arr = iconsByKat.get(r.kategorie_id) ?? [];
    if (r.icons?.label) arr.push(r.icons.label);
    iconsByKat.set(r.kategorie_id, arr);
  }

  const bereichName = new Map((bereiche ?? []).map((b) => [b.id, b.name]));

  const withUrls = await Promise.all(
    (kategorien ?? []).map(async (k) => ({
      ...k, vorschaubild_url: await getSignedUrl("produktbilder", k.vorschaubild_path),
    })),
  );

  const items = withUrls.map((k) => ({
    id: k.id,
    name: k.name,
    bereich_id: k.bereich_id,
    bereichName: bereichName.get(k.bereich_id) ?? "\u2014",
    vorschaubild_url: k.vorschaubild_url,
    prodCount: prodCount.get(k.id) ?? 0,
    icons: iconsByKat.get(k.id) ?? [],
  }));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Katalogstruktur"
        title="Kategorien"
        subtitle={`${items.length} ${bereich ? "Kategorien in diesem Bereich" : "Kategorien insgesamt"}`}
      >
        <Button asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Link href={`/kategorien/neu${bereich ? `?bereich=${bereich}` : ""}`}>
            <Plus className="mr-2 h-4 w-4" /> Neue Kategorie
          </Link>
        </Button>
      </PageHeader>

      <form className="flex gap-2 items-center mb-4 p-3 rounded-xl border bg-background">
        <Filter className="h-4 w-4 text-muted-foreground ml-1" />
        <label htmlFor="bereich" className="text-sm text-muted-foreground">Bereich:</label>
        <select id="bereich" name="bereich" defaultValue={bereich ?? ""} className="rounded-lg border px-3 py-1.5 bg-background text-sm hover:border-primary/50 transition-colors">
          <option value="">Alle Bereiche</option>
          {(bereiche ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <Button type="submit" size="sm" variant="outline" className="hover:bg-primary hover:text-primary-foreground transition-colors">
          Anwenden
        </Button>
        {bereich && (
          <Button asChild type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
            <Link href="/kategorien">Zurücksetzen</Link>
          </Button>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Keine Kategorien"
          description="Erstellen Sie eine Kategorie, um Produkte thematisch zu gruppieren."
          actionLabel="Kategorie anlegen"
          actionHref={`/kategorien/neu${bereich ? `?bereich=${bereich}` : ""}`}
        />
      ) : (
        <SortableKategorienList initialItems={items} />
      )}
    </AppShell>
  );
}
