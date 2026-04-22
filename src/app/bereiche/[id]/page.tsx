import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { bildProxyUrl } from "@/lib/bild-url";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      <div className="flex flex-col gap-5">
        <div className="crumbs">
          <Link href="/">Dashboard</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/bereiche">Bereiche</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{bereich.name}</span>
        </div>

        {/* BEREICH HEADER */}
        <div className="glass-card space-y-5 px-6 py-[22px]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1 basis-[320px]">
              <div className="eyebrow mb-1.5 text-primary">Bereich</div>
              <h1 className="display-lg">{bereich.name}</h1>
              {bereich.beschreibung && (
                <div className="mt-3 text-[14px] text-muted-foreground">
                  <RichTextDisplay html={bereich.beschreibung} />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-9 w-9 shrink-0 rounded-[10px] border border-border/60"
                  style={{ backgroundColor: bereich.farbe || "transparent" }}
                  title={bereich.farbe ?? "keine Farbe"}
                />
                <div>
                  <div className="eyebrow !text-[10px]">Farbe</div>
                  <div className="mt-0.5 font-mono text-[12px] text-muted-foreground">
                    {bereich.farbe ?? "—"}
                  </div>
                </div>
              </div>

              <div>
                <div className="eyebrow !text-[10px]">Sortierung</div>
                <div className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-[-0.015em]">
                  {bereich.sortierung}
                </div>
              </div>

              <div className="flex items-end gap-4 border-l border-border/60 pl-5">
                <div>
                  <div className="eyebrow !text-[10px]">Seiten</div>
                  <div className="mt-0.5 text-[18px] font-semibold tabular-nums">
                    {bereich.seitenzahl ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="eyebrow !text-[10px]">Start</div>
                  <div className="mt-0.5 text-[18px] font-semibold tabular-nums">
                    {bereich.startseite ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="eyebrow !text-[10px]">Ende</div>
                  <div className="mt-0.5 text-[18px] font-semibold tabular-nums">
                    {bereich.endseite ?? "—"}
                  </div>
                </div>
              </div>

              <Button asChild size="sm">
                <Link href={`/bereiche/${id}/bearbeiten`}>
                  <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* BILD + KATEGORIEN-TABELLE */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          <div className="glass-card">
            <div className="border-b border-border/60 px-4 py-3">
              <div className="eyebrow !text-[10px]">Katalog-Bild</div>
            </div>
            <div className="p-4">
              <div className="relative aspect-[210/297] overflow-hidden rounded-[12px] border border-border/60 bg-muted">
                {bereichBildUrl ? (
                  <Image
                    src={bereichBildUrl}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 280px"
                    className="object-contain"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground/30">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <span className="text-[14.5px] font-semibold tracking-[-0.01em]">
                  Kategorien
                </span>
                <span className="pill pill-accent">{(kategorien ?? []).length}</span>
              </div>
              <Button asChild size="sm">
                <Link href={`/kategorien/neu?bereich=${id}`}>
                  <Plus className="h-3.5 w-3.5" /> Neu
                </Link>
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 pl-5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    #
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Name
                  </TableHead>
                  <TableHead className="w-24 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Artikel
                  </TableHead>
                  <TableHead className="w-24 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Sort
                  </TableHead>
                  <TableHead className="w-24 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Start
                  </TableHead>
                  <TableHead className="w-24 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Ende
                  </TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(kategorien ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Layers className="mx-auto mb-2 h-8 w-8 opacity-30" />
                      Noch keine Kategorien in diesem Bereich
                    </TableCell>
                  </TableRow>
                )}
                {(kategorien ?? []).map((k, i) => (
                  <TableRow key={k.id} className="group relative border-border/60">
                    <TableCell className="pl-5 font-mono text-[11.5px] tabular-nums text-muted-foreground/70">
                      {String(i + 1).padStart(2, "0")}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/kategorien/${k.id}`}
                        className="absolute inset-0 z-0"
                        aria-label={`${k.name} öffnen`}
                      />
                      <span className="pointer-events-none relative z-10 transition-colors group-hover:text-primary">
                        {k.name}
                      </span>
                    </TableCell>
                    <TableCell className="pointer-events-none relative z-10 text-right font-semibold tabular-nums text-primary">
                      {prodCount.get(k.id) ?? 0}
                    </TableCell>
                    <TableCell className="pointer-events-none relative z-10 text-right font-mono tabular-nums text-muted-foreground">
                      {k.sortierung}
                    </TableCell>
                    <TableCell className="pointer-events-none relative z-10 text-right font-mono tabular-nums text-muted-foreground">
                      {k.startseite ?? "—"}
                    </TableCell>
                    <TableCell className="pointer-events-none relative z-10 text-right font-mono tabular-nums text-muted-foreground">
                      {k.endseite ?? "—"}
                    </TableCell>
                    <TableCell className="relative z-20">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/kategorien/${k.id}/bearbeiten`} title="Bearbeiten">
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <DeleteKategorieButton id={k.id} name={k.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
