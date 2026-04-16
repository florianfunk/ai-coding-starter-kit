import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Layers, Pencil, ChevronRight } from "lucide-react";
import { DeleteKategorieButton } from "./delete-button";

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

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kategorien</h1>
            <p className="text-muted-foreground mt-1">{withUrls.length} Kategorien {bereich ? "in diesem Bereich" : "im Katalog"}</p>
          </div>
          <Button asChild size="lg">
            <Link href={`/kategorien/neu${bereich ? `?bereich=${bereich}` : ""}`}>
              <Plus className="mr-2 h-4 w-4" /> Neue Kategorie
            </Link>
          </Button>
        </div>

        <form className="flex gap-2 items-center">
          <label htmlFor="bereich" className="text-sm text-muted-foreground">Bereich-Filter:</label>
          <select id="bereich" name="bereich" defaultValue={bereich ?? ""} className="rounded-lg border px-3 py-1.5 bg-background text-sm">
            <option value="">Alle Bereiche</option>
            {(bereiche ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Button type="submit" size="sm" variant="outline">Anwenden</Button>
          {bereich && <Button asChild type="button" variant="ghost" size="sm"><Link href="/kategorien">Zurücksetzen</Link></Button>}
        </form>

        {withUrls.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Keine Kategorien.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {withUrls.map((k, i) => (
              <Card key={k.id} className="group hover:shadow-md hover:border-primary/30 transition-all relative">
                <CardContent className="flex items-center gap-5 py-4">
                  <Link href={`/kategorien/${k.id}`} className="absolute inset-0 z-0" aria-label={`${k.name} öffnen`} />

                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 relative z-10">
                    {i + 1}
                  </div>

                  <div className="h-16 w-24 rounded-lg bg-muted overflow-hidden shrink-0 relative z-10">
                    {k.vorschaubild_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={k.vorschaubild_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                        <Layers className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 relative z-10 pointer-events-none">
                    <div className="font-semibold text-lg group-hover:text-primary transition">{k.name}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">{bereichName.get(k.bereich_id) ?? "—"}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(iconsByKat.get(k.id) ?? []).slice(0, 6).map((label) => (
                        <Badge key={label} variant="secondary" className="text-xs">{label}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-6 shrink-0 relative z-10 pointer-events-none">
                    <div className="text-center">
                      <p className="text-lg font-semibold">{prodCount.get(k.id) ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Produkte</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 relative z-20">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/kategorien/${k.id}/bearbeiten`}>
                        <Pencil className="h-4 w-4 mr-1" /> Bearbeiten
                      </Link>
                    </Button>
                    <DeleteKategorieButton id={k.id} name={k.name} />
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition ml-1 pointer-events-none" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
