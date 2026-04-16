import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Layers, Pencil, ChevronRight } from "lucide-react";
import { DeleteBereichButton } from "./delete-button";

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

  const withUrls = await Promise.all(
    (bereiche ?? []).map(async (b) => ({
      ...b, bild_url: await getSignedUrl("produktbilder", b.bild_path),
    })),
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bereiche</h1>
            <p className="text-muted-foreground mt-1">{withUrls.length} Hauptkategorien im Katalog</p>
          </div>
          <Button asChild size="lg">
            <Link href="/bereiche/neu"><Plus className="mr-2 h-4 w-4" /> Neuer Bereich</Link>
          </Button>
        </div>

        {withUrls.length === 0 && (
          <Card><CardContent className="py-16 text-center text-muted-foreground">Noch keine Bereiche angelegt.</CardContent></Card>
        )}

        <div className="grid gap-3">
          {withUrls.map((b, i) => (
            <Card key={b.id} className="group hover:shadow-md hover:border-primary/30 transition-all relative">
              <CardContent className="flex items-center gap-5 py-4">
                <Link href={`/bereiche/${b.id}`} className="absolute inset-0 z-0" aria-label={`${b.name} öffnen`} />

                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 relative z-10">
                  {i + 1}
                </div>

                <div className="h-16 w-24 rounded-lg bg-muted overflow-hidden shrink-0 relative z-10">
                  {b.bild_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.bild_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                      <Layers className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 relative z-10 pointer-events-none">
                  <div className="font-semibold text-lg group-hover:text-primary transition">{b.name}</div>
                  {b.beschreibung && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{b.beschreibung}</p>
                  )}
                </div>

                <div className="hidden md:flex items-center gap-6 shrink-0 relative z-10 pointer-events-none">
                  <div className="text-center">
                    <p className="text-lg font-semibold">{katCount.get(b.id) ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Kategorien</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">{prodCount.get(b.id) ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Produkte</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">S. {b.startseite ?? "—"}</Badge>
                </div>

                <div className="flex items-center gap-1 shrink-0 relative z-20">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/bereiche/${b.id}/bearbeiten`}>
                      <Pencil className="h-4 w-4 mr-1" /> Bearbeiten
                    </Link>
                  </Button>
                  <DeleteBereichButton id={b.id} name={b.name} />
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition ml-1 pointer-events-none" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
