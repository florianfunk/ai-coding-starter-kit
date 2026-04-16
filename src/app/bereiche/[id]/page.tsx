import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Layers, Pencil, ChevronRight, ChevronLeft, Trash2 } from "lucide-react";
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

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/bereiche"><ChevronLeft className="h-4 w-4 mr-1" /> Alle Bereiche</Link>
          </Button>
        </div>

        {/* BEREICH HEADER — wie FileMaker */}
        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Name + Sortierung */}
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 items-end">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Name</p>
                <h1 className="text-3xl font-bold tracking-tight border-b-2 border-b-accent pb-2">
                  {bereich.name}
                </h1>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Sortierung</p>
                <div className="text-3xl font-bold tracking-tight border-b-2 border-b-accent pb-2">
                  {bereich.sortierung}
                </div>
              </div>
            </div>

            {/* Farbfeld */}
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 items-end">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Farbfeld</p>
                <div className="font-mono border-b-2 border-b-accent pb-2">
                  {bereich.farbe ?? <span className="text-muted-foreground">—</span>}
                </div>
              </div>
              <div className="h-12 rounded-lg border" style={{ backgroundColor: bereich.farbe || undefined }} />
            </div>

            {/* Beschreibung */}
            {bereich.beschreibung && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Beschreibung</p>
                <p className="text-sm">{bereich.beschreibung}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button asChild variant="outline">
                <Link href={`/bereiche/${id}/bearbeiten`}>
                  <Pencil className="h-4 w-4 mr-1" /> Bereich bearbeiten
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* BILD + KATEGORIEN-TABELLE */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Bild</CardTitle></CardHeader>
            <CardContent>
              <div className="aspect-[4/3] rounded-lg border bg-muted overflow-hidden">
                {bereichBildUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bereichBildUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground/40">
                    <Layers className="h-10 w-10" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                {bereich.seitenzahl ? `Seitenzahl: ${bereich.seitenzahl}` : "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-primary text-primary-foreground flex flex-row items-center justify-between py-3 rounded-t-xl">
              <CardTitle className="text-base">Kategorien</CardTitle>
              <Button asChild size="sm" variant="secondary" className="h-7">
                <Link href={`/kategorien/neu?bereich=${id}`}>
                  <Plus className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right w-24">Anzahl<br/>Artikel</TableHead>
                    <TableHead className="text-right w-24">Sortierung</TableHead>
                    <TableHead className="text-right w-24">Startseite</TableHead>
                    <TableHead className="text-right w-24">Endseite</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(kategorien ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        Noch keine Kategorien in diesem Bereich.
                      </TableCell>
                    </TableRow>
                  )}
                  {(kategorien ?? []).map((k, i) => (
                    <TableRow key={k.id} className="group relative">
                      <TableCell className="relative z-10 pointer-events-none text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium relative z-10 pointer-events-none">
                        <Link href={`/kategorien/${k.id}`} className="absolute inset-0 z-0 pointer-events-auto" aria-label={`${k.name} öffnen`} />
                        <span className="relative z-10">{k.name}</span>
                      </TableCell>
                      <TableCell className="text-right relative z-10 pointer-events-none">{prodCount.get(k.id) ?? 0}</TableCell>
                      <TableCell className="text-right relative z-10 pointer-events-none">{k.sortierung}</TableCell>
                      <TableCell className="text-right relative z-10 pointer-events-none">{k.startseite ?? "—"}</TableCell>
                      <TableCell className="text-right relative z-10 pointer-events-none">{k.endseite ?? "—"}</TableCell>
                      <TableCell className="relative z-20">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Link href={`/kategorien/${k.id}/bearbeiten`} title="Bearbeiten">
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <DeleteKategorieButton id={k.id} name={k.name} />
                          <Link href={`/kategorien/${k.id}`} className="text-accent-foreground/70 hover:text-accent-foreground">
                            <ChevronRight className="h-5 w-5" />
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
