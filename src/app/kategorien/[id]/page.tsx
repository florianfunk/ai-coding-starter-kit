import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { bildProxyUrl } from "@/lib/bild-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Plus, Package, Pencil, ChevronRight, ImageIcon, Layers } from "lucide-react";
import { RichTextDisplay } from "@/components/rich-text-display";

export const dynamic = "force-dynamic";

export default async function KategorieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: kategorie } = await supabase.from("kategorien").select("*").eq("id", id).single();
  if (!kategorie) notFound();

  const [{ data: bereich }, { data: produkte }, { data: iconLinks }] = await Promise.all([
    supabase.from("bereiche").select("id,name").eq("id", kategorie.bereich_id).single(),
    supabase.from("produkte").select("*").eq("kategorie_id", id).order("sortierung"),
    supabase.from("kategorie_icons").select("icons(label,symbol_path)").eq("kategorie_id", id),
  ]);

  const bildUrls = {
    bild1: bildProxyUrl("produktbilder", kategorie.bild1_path),
    bild2: bildProxyUrl("produktbilder", kategorie.bild2_path),
    bild3: bildProxyUrl("produktbilder", kategorie.bild3_path),
    bild4: bildProxyUrl("produktbilder", kategorie.bild4_path),
  };
  const primaryBildUrl = bildUrls.bild1 ?? bildUrls.bild2 ?? bildUrls.bild3 ?? bildUrls.bild4 ?? null;
  const hatBilder = Boolean(bildUrls.bild1 || bildUrls.bild2 || bildUrls.bild3 || bildUrls.bild4);
  const iconData = ((iconLinks ?? []) as any[]).map((r) => ({
    label: r.icons?.label ?? "",
    url: bildProxyUrl("produktbilder", r.icons?.symbol_path ?? null),
  }));

  const produkteMitBild = (produkte ?? []).map((p) => ({
    ...p,
    hauptbild_url: bildProxyUrl("produktbilder", p.hauptbild_path),
  }));

  const prodIds = produkteMitBild.map((p) => p.id);
  const { data: preise } = prodIds.length
    ? await supabase.from("aktuelle_preise").select("produkt_id, listenpreis").in("produkt_id", prodIds)
    : { data: [] };
  const preisMap = new Map<string, number>();
  for (const p of preise ?? []) preisMap.set(p.produkt_id, Number(p.listenpreis));

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
              <BreadcrumbLink asChild><Link href="/kategorien">Kategorien</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{kategorie.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* HEADER */}
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
              <div className="flex items-start gap-5 flex-1">
                <div className="h-24 w-32 rounded-lg border-2 bg-muted overflow-hidden shrink-0 relative">
                  {primaryBildUrl ? (
                    <Image
                      src={primaryBildUrl}
                      alt=""
                      fill
                      sizes="128px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground/30">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div>
                  <Link href={`/bereiche/${kategorie.bereich_id}`} className="text-xs uppercase tracking-widest text-primary font-semibold hover:underline">
                    {bereich?.name}
                  </Link>
                  <h1 className="text-3xl font-bold tracking-tight mt-1 accent-underline inline-block">
                    {kategorie.name}
                  </h1>
                  {kategorie.beschreibung && (
                    <RichTextDisplay html={kategorie.beschreibung} className="text-muted-foreground mt-3 max-w-2xl" />
                  )}
                  {iconData.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {iconData.map((ic, i) => (
                        <div key={i} className="inline-flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1 border">
                          {ic.url ? (
                            <Image
                              src={ic.url}
                              alt={ic.label}
                              width={20}
                              height={20}
                              className="h-5 w-5 object-contain"
                            />
                          ) : null}
                          <span className="text-xs font-medium">{ic.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button asChild variant="outline" className="hover:bg-primary hover:text-primary-foreground transition-colors">
                  <Link href={`/kategorien/${id}/bearbeiten`}>
                    <Pencil className="h-4 w-4 mr-2" /> Bearbeiten
                  </Link>
                </Button>
                <Button asChild className="shadow-sm">
                  <Link href={`/produkte/neu?kategorie=${id}`}>
                    <Plus className="h-4 w-4 mr-2" /> Neues Produkt
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KATALOG-BILDER: FileMaker-Anordnung */}
        {hatBilder && (
          <Card className="border-2">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Bilder für Katalog-Seite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-[4/2] w-full max-w-2xl grid grid-cols-4 grid-rows-2 gap-2 bg-muted/30 rounded-lg border p-2">
                <BildKachel url={bildUrls.bild1} label="Bild 1" size="15 × 3 cm" className="col-span-3 row-span-1" />
                <BildKachel url={bildUrls.bild3} label="Bild 3" size="5 × 3 cm" className="col-span-1 row-span-2" />
                <BildKachel url={bildUrls.bild2} label="Bild 2" size="15 × 3 cm" className="col-span-3 row-span-1" />
                <BildKachel url={bildUrls.bild4} label="Bild 4" size="5 × 3 cm" className="col-start-4 row-start-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* PRODUKTE-TABELLE */}
        <Card className="border-2">
          <CardHeader className="bg-primary text-primary-foreground py-3 rounded-t-xl flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" /> Produkte ({produkteMitBild.length})
            </CardTitle>
            <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/80 h-7">
              <Link href={`/produkte/neu?kategorie=${id}`}>
                <Plus className="h-4 w-4 mr-1" /> Neu
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {produkteMitBild.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
                Noch keine Produkte in dieser Kategorie
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-16">Bild</TableHead>
                    <TableHead>Artikelnummer</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead className="text-right w-24">Sortierung</TableHead>
                    <TableHead className="text-right w-28">Listenpreis</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produkteMitBild.map((p) => (
                    <TableRow key={p.id} className="group relative row-hover">
                      <TableCell className="relative z-10 pointer-events-none">
                        {p.hauptbild_url ? (
                          <Image
                            src={p.hauptbild_url}
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded object-cover border"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center border">
                            <Package className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/produkte/${p.id}`} className="absolute inset-0 z-0" />
                        <span className="relative z-10 pointer-events-none font-mono text-sm group-hover:text-primary transition-colors">
                          {p.artikelnummer}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md relative z-10 pointer-events-none">
                        <div className="truncate">{p.name ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-right text-sm relative z-10 pointer-events-none">{p.sortierung}</TableCell>
                      <TableCell className="text-right font-semibold relative z-10 pointer-events-none">
                        {preisMap.has(p.id) ? (
                          <span className="text-primary">{preisMap.get(p.id)!.toFixed(2)} €</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="relative z-10 pointer-events-none">
                        {p.artikel_bearbeitet
                          ? <Badge className="bg-success/90 text-success-foreground hover:bg-success text-[10px]">bearbeitet</Badge>
                          : <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">unbearbeitet</Badge>}
                      </TableCell>
                      <TableCell className="relative z-20">
                        <Link href={`/produkte/${p.id}`} className="inline-flex items-center text-muted-foreground/50 hover:text-primary transition-colors p-1">
                          <ChevronRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function BildKachel({
  url,
  label,
  size,
  className,
}: {
  url: string | null | undefined;
  label: string;
  size: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-md border bg-background ${className ?? ""}`}>
      {url ? (
        <Image src={url} alt="" fill sizes="400px" className="object-cover" />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center text-xs text-muted-foreground/70 gap-0.5">
          <span className="font-medium">{label}</span>
          <span className="text-[10px]">{size}</span>
        </div>
      )}
    </div>
  );
}
