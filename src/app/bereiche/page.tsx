import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Layers, Pencil, ChevronRight, ImageIcon, Package } from "lucide-react";
import { DeleteBereichButton } from "./delete-button";
import { EmptyState } from "@/components/empty-state";

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
      <PageHeader
        eyebrow="Katalogstruktur"
        title="Bereiche"
        subtitle={`${withUrls.length} Hauptkategorien`}
      >
        <Button asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Link href="/bereiche/neu">
            <Plus className="mr-2 h-4 w-4" /> Neuer Bereich
          </Link>
        </Button>
      </PageHeader>

      {withUrls.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Keine Bereiche vorhanden"
          description="Legen Sie Ihren ersten Bereich an, um die Katalogstruktur aufzubauen."
          actionLabel="Bereich anlegen"
          actionHref="/bereiche/neu"
        />
      ) : (
        <div className="grid gap-3">
          {withUrls.map((b, i) => (
            <Card key={b.id} className="group card-hover border-2 overflow-hidden">
              <CardContent className="flex items-center gap-5 py-4 relative">
                <Link href={`/bereiche/${b.id}`} className="absolute inset-0 z-0" aria-label={`${b.name} öffnen`} />

                <div
                  className="h-11 w-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 relative z-10 border-2"
                  style={b.farbe ? { backgroundColor: b.farbe, borderColor: b.farbe } : undefined}
                >
                  <span className={b.farbe ? "text-foreground/80" : "text-primary"}>{i + 1}</span>
                </div>

                <div className="h-16 w-24 rounded-lg bg-muted overflow-hidden shrink-0 relative z-10 border">
                  {b.bild_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.bild_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground/30">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 relative z-10 pointer-events-none">
                  <div className="font-semibold text-lg group-hover:text-primary transition-colors">{b.name}</div>
                  {b.beschreibung && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{b.beschreibung}</p>
                  )}
                </div>

                <div className="hidden md:flex items-center gap-4 shrink-0 relative z-10 pointer-events-none">
                  <div className="text-center min-w-14">
                    <p className="text-2xl font-bold leading-none text-primary">{katCount.get(b.id) ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Kategorien</p>
                  </div>
                  <div className="text-center min-w-14">
                    <p className="text-2xl font-bold leading-none">{prodCount.get(b.id) ?? 0}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Produkte</p>
                  </div>
                  <div className="text-center min-w-14">
                    <p className="text-sm font-semibold leading-none">S. {b.startseite ?? "—"}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Start</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 relative z-20">
                  <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
                    <Link href={`/bereiche/${b.id}/bearbeiten`}>
                      <Pencil className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Bearbeiten</span>
                    </Link>
                  </Button>
                  <DeleteBereichButton id={b.id} name={b.name} />
                  <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all ml-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
