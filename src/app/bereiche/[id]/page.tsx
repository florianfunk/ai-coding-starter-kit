import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Layers, Pencil, ChevronRight, ChevronLeft } from "lucide-react";
import { DeleteKategorieButton } from "@/app/kategorien/delete-button";

export const dynamic = "force-dynamic";

export default async function BereichDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: bereich } = await supabase.from("bereiche").select("*").eq("id", id).single();
  if (!bereich) notFound();

  const bereichBildUrl = await getSignedUrl("produktbilder", bereich.bild_path);

  const { data: kategorien } = await supabase
    .from("kategorien").select("*").eq("bereich_id", id).order("sortierung");

  const katIds = (kategorien ?? []).map((k) => k.id);
  const { data: prodStats } = katIds.length
    ? await supabase.from("produkte").select("kategorie_id").in("kategorie_id", katIds).limit(5000)
    : { data: [] };
  const prodCount = new Map<string, number>();
  for (const r of prodStats ?? []) prodCount.set(r.kategorie_id, (prodCount.get(r.kategorie_id) ?? 0) + 1);

  const { data: iconLinks } = katIds.length
    ? await supabase.from("kategorie_icons").select("kategorie_id, icons(label)").in("kategorie_id", katIds)
    : { data: [] };
  const iconsByKat = new Map<string, string[]>();
  for (const r of (iconLinks ?? []) as any[]) {
    const arr = iconsByKat.get(r.kategorie_id) ?? [];
    if (r.icons?.label) arr.push(r.icons.label);
    iconsByKat.set(r.kategorie_id, arr);
  }

  const withUrls = await Promise.all(
    (kategorien ?? []).map(async (k) => ({
      ...k, vorschaubild_url: await getSignedUrl("produktbilder", k.vorschaubild_path),
    })),
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/bereiche"><ChevronLeft className="h-4 w-4 mr-1" /> Alle Bereiche</Link>
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {bereichBildUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bereichBildUrl} alt="" className="h-16 w-24 rounded-lg object-cover border" />
              )}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Bereich</p>
                <h1 className="text-3xl font-bold tracking-tight">{bereich.name}</h1>
                {bereich.beschreibung && (
                  <p className="text-muted-foreground mt-1">{bereich.beschreibung}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href={`/bereiche/${id}/bearbeiten`}>
                  <Pencil className="h-4 w-4 mr-1" /> Bereich bearbeiten
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/kategorien/neu?bereich=${id}`}>
                  <Plus className="h-4 w-4 mr-1" /> Neue Kategorie
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">Kategorien ({withUrls.length})</h2>

          {withUrls.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">Noch keine Kategorien in diesem Bereich.</CardContent></Card>
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
                      {k.beschreibung && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{k.beschreibung}</p>
                      )}
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
      </div>
    </AppShell>
  );
}
