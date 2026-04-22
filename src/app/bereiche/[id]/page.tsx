import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { bildProxyUrl } from "@/lib/bild-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Plus, Layers, Pencil, ChevronRight, ImageIcon } from "lucide-react";
import { DeleteKategorieButton } from "@/app/kategorien/delete-button";
import { RichTextDisplay } from "@/components/rich-text-display";

export const dynamic = "force-dynamic";

export default async function BereichDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: bereich } = await supabase.from("bereiche").select("*").eq("id", id).single();
  if (!bereich) notFound();

  const bereichBildUrl = bildProxyUrl("produktbilder", bereich.bild_path);

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
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/">Dashboard</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/bereiche">Bereiche</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{bereich.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* BEREICH HEADER */}
        <Card className="border-2">
          <CardContent className="pt-6 space-y-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              {/* Name — Hauptelement */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Name</p>
                <h1 className="text-3xl font-bold tracking-tight accent-underline inline-block">
                  {bereich.name}
                </h1>
              </div>

              {/* Farbe — kompakt: Swatch + Hex */}
              <div className="shrink-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Farbe</p>
                <div className="flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-md border shadow-inner shrink-0"
                    style={{ backgroundColor: bereich.farbe || "transparent" }}
                    title={bereich.farbe ?? "keine Farbe"}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {bereich.farbe ?? "—"}
                  </span>
                </div>
              </div>

              {/* Sortierung — kompakt rechts */}
              <div className="shrink-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Sortierung</p>
                <div className="text-lg font-semibold tabular-nums tracking-tight">
                  {bereich.sortierung}
                </div>
              </div>

              {/* Seiten — Gruppe: Seitenzahl / Start / Ende */}
              <div className="shrink-0 border-l pl-6">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Katalog-Seiten</p>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Anzahl</p>
                    <p className="text-lg font-semibold tabular-nums">{bereich.seitenzahl ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Start</p>
                    <p className="text-lg font-semibold tabular-nums">{bereich.startseite ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Ende</p>
                    <p className="text-lg font-semibold tabular-nums">{bereich.endseite ?? "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            {bereich.beschreibung && (
              <div className="pt-2 border-t">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Beschreibung</p>
                <RichTextDisplay html={bereich.beschreibung} />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button asChild size="sm" className="shadow-sm">
                <Link href={`/bereiche/${id}/bearbeiten`}>
                  <Pencil className="h-4 w-4 mr-2" /> Bereich bearbeiten
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* BILD + KATEGORIEN-TABELLE */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest text-primary">Bild</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-[210/297] rounded-lg border-2 bg-muted overflow-hidden relative">
                {bereichBildUrl ? (
                  <Image
                    src={bereichBildUrl}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 280px"
                    className="object-contain"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground/30">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="bg-primary text-primary-foreground flex flex-row items-center justify-between py-3 rounded-t-xl">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" /> Kategorien ({(kategorien ?? []).length})
              </CardTitle>
              <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/80 h-7">
                <Link href={`/kategorien/neu?bereich=${id}`}>
                  <Plus className="h-4 w-4 mr-1" /> Neu
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-12 text-muted-foreground">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right w-24">Anzahl Artikel</TableHead>
                    <TableHead className="text-right w-24">Sortierung</TableHead>
                    <TableHead className="text-right w-24">Startseite</TableHead>
                    <TableHead className="text-right w-24">Endseite</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(kategorien ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                        <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Noch keine Kategorien in diesem Bereich
                      </TableCell>
                    </TableRow>
                  )}
                  {(kategorien ?? []).map((k, i) => (
                    <TableRow key={k.id} className="group relative row-hover">
                      <TableCell className="text-muted-foreground relative z-10 pointer-events-none">{i + 1}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/kategorien/${k.id}`} className="absolute inset-0 z-0" aria-label={`${k.name} öffnen`} />
                        <span className="relative z-10 pointer-events-none group-hover:text-primary transition-colors">
                          {k.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary relative z-10 pointer-events-none">
                        {prodCount.get(k.id) ?? 0}
                      </TableCell>
                      <TableCell className="text-right relative z-10 pointer-events-none">{k.sortierung}</TableCell>
                      <TableCell className="text-right relative z-10 pointer-events-none">{k.startseite ?? "—"}</TableCell>
                      <TableCell className="text-right relative z-10 pointer-events-none">{k.endseite ?? "—"}</TableCell>
                      <TableCell className="relative z-20">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary">
                            <Link href={`/kategorien/${k.id}/bearbeiten`} title="Bearbeiten">
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <DeleteKategorieButton id={k.id} name={k.name} />
                          <Link href={`/kategorien/${k.id}`} className="text-muted-foreground/50 hover:text-primary p-1 transition-colors">
                            <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
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
