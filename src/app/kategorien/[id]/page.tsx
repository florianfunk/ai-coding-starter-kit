import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { bildProxyUrl } from "@/lib/bild-url";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, Pencil, ChevronRight, ImageIcon, Layers } from "lucide-react";
import { RichTextDisplay } from "@/components/rich-text-display";

export const dynamic = "force-dynamic";

export default async function KategorieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: kategorie } = await supabase.from("kategorien").select("*").eq("id", id).single();
  if (!kategorie) notFound();

  const [{ data: bereich }, { data: produkte }, { data: iconLinks }] = await Promise.all([
    supabase.from("bereiche").select("id,name,farbe").eq("id", kategorie.bereich_id).single(),
    supabase.from("produkte").select("*").eq("kategorie_id", id).order("sortierung"),
    supabase.from("kategorie_icons").select("icons(label,symbol_path)").eq("kategorie_id", id),
  ]);

  const bildUrls = {
    bild1: bildProxyUrl("produktbilder", kategorie.bild1_path),
    bild2: bildProxyUrl("produktbilder", kategorie.bild2_path),
    bild3: bildProxyUrl("produktbilder", kategorie.bild3_path),
    bild4: bildProxyUrl("produktbilder", kategorie.bild4_path),
  };
  const hatBilder = Boolean(bildUrls.bild1 || bildUrls.bild2 || bildUrls.bild3 || bildUrls.bild4);
  const iconData = ((iconLinks ?? []) as unknown as Array<{ icons: { label: string; symbol_path: string | null } | null }>).map(
    (r) => ({
      label: r.icons?.label ?? "",
      url: bildProxyUrl("produktbilder", r.icons?.symbol_path ?? null),
    }),
  );

  const produkteMitBild = (produkte ?? []).map((p) => ({
    ...p,
    hauptbild_url: bildProxyUrl("produktbilder", p.hauptbild_path),
  }));

  const prodIds = produkteMitBild.map((p) => p.id);
  const { data: preise } = prodIds.length
    ? await supabase
        .from("aktuelle_preise_flat")
        .select("produkt_id, listenpreis, ek_lichtengros, ek_eisenkeil")
        .in("produkt_id", prodIds)
    : { data: [] };
  type PreisEntry = { listenpreis: number | null; ekLG: number | null; ekEK: number | null };
  const preisMap = new Map<string, PreisEntry>();
  for (const p of preise ?? [])
    preisMap.set(p.produkt_id, {
      listenpreis: p.listenpreis != null ? Number(p.listenpreis) : null,
      ekLG: p.ek_lichtengros != null ? Number(p.ek_lichtengros) : null,
      ekEK: p.ek_eisenkeil != null ? Number(p.ek_eisenkeil) : null,
    });

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="crumbs">
          <Link href="/">Dashboard</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/kategorien">Kategorien</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{kategorie.name}</span>
        </div>

        {/* HEADER */}
        <div className="glass-card px-6 py-[22px]">
          <div className="mb-4 flex justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/kategorien/${id}/bearbeiten`}>
                <Pencil className="h-3.5 w-3.5" /> Bearbeiten
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/produkte/neu?kategorie=${id}`}>
                <Plus className="h-3.5 w-3.5" /> Neues Produkt
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-3">
              <div>
                <Link
                  href={`/bereiche/${kategorie.bereich_id}`}
                  className="eyebrow inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  {bereich?.farbe && (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm border border-border/50"
                      style={{ backgroundColor: bereich.farbe }}
                    />
                  )}
                  {bereich?.name}
                </Link>
                <h1 className="display-lg mt-2">{kategorie.name}</h1>
              </div>

              {kategorie.beschreibung && (
                <RichTextDisplay html={kategorie.beschreibung} className="text-[14px] text-muted-foreground" />
              )}

              {iconData.length > 0 && (
                <div>
                  <div className="eyebrow mb-2 !text-[10px]">Eigenschaften</div>
                  <div className="flex flex-wrap gap-2">
                    {iconData.map((ic, i) => (
                      <div
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted px-2.5 py-1"
                      >
                        {ic.url ? (
                          <Image
                            src={ic.url}
                            alt={ic.label}
                            width={20}
                            height={20}
                            unoptimized
                            className="h-5 w-5 object-contain"
                          />
                        ) : null}
                        <span className="text-[12px] font-medium">{ic.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="eyebrow mb-2 flex items-center gap-1.5 !text-[10px]">
                <ImageIcon className="h-3 w-3" /> Katalog-Bilder
              </div>
              {hatBilder ? (
                <div className="grid aspect-[4/2] w-full grid-cols-4 grid-rows-2 gap-2 rounded-[14px] border border-border/60 bg-muted/40 p-2">
                  <BildKachel url={bildUrls.bild1} label="Bild 1" size="15 × 3 cm" className="col-span-3 row-span-1" />
                  <BildKachel url={bildUrls.bild3} label="Bild 3" size="5 × 3 cm" className="col-span-1 row-span-2" />
                  <BildKachel url={bildUrls.bild2} label="Bild 2" size="15 × 3 cm" className="col-span-3 row-span-1" />
                  <BildKachel url={bildUrls.bild4} label="Bild 4" size="5 × 3 cm" className="col-start-4 row-start-2" />
                </div>
              ) : (
                <div className="flex aspect-[4/2] w-full flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-border bg-muted/40 text-muted-foreground/60">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-[12px]">Keine Bilder hinterlegt</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PRODUKTE-TABELLE */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-[14.5px] font-semibold tracking-[-0.01em]">Produkte</span>
              <span className="pill pill-accent">{produkteMitBild.length}</span>
            </div>
            <Button asChild size="sm">
              <Link href={`/produkte/neu?kategorie=${id}`}>
                <Plus className="h-3.5 w-3.5" /> Neu
              </Link>
            </Button>
          </div>

          {produkteMitBild.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Layers className="mx-auto mb-2 h-10 w-10 opacity-30" />
              Noch keine Produkte in dieser Kategorie
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 pl-5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Bild
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Artikelnummer
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Bezeichnung
                  </TableHead>
                  <TableHead className="w-24 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Sort
                  </TableHead>
                  <TableHead className="w-28 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Listenpreis
                  </TableHead>
                  <TableHead className="w-28 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    EK Lichtengros
                  </TableHead>
                  <TableHead className="w-28 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    EK Eisenkeil
                  </TableHead>
                  <TableHead className="w-28 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Status
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {produkteMitBild.map((p) => (
                  <TableRow key={p.id} className="group relative border-border/60">
                    <TableCell className="pointer-events-none relative z-10 pl-5">
                      {p.hauptbild_url ? (
                        <Image
                          src={p.hauptbild_url}
                          alt=""
                          width={40}
                          height={40}
                          unoptimized
                          className="h-10 w-10 rounded-[8px] border border-border/60 object-cover"
                        />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-[8px] border border-border/60 bg-muted">
                          <Package className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/produkte/${p.id}`} className="absolute inset-0 z-0" />
                      <span className="pointer-events-none relative z-10 font-mono text-[13px] transition-colors group-hover:text-primary">
                        {p.artikelnummer}
                      </span>
                    </TableCell>
                    <TableCell className="pointer-events-none relative z-10 max-w-md">
                      <div className="truncate">{p.name ?? "—"}</div>
                    </TableCell>
                    <TableCell className="pointer-events-none relative z-10 text-right font-mono tabular-nums text-muted-foreground">
                      {p.sortierung}
                    </TableCell>
                    <TableCell className="pointer-events-none relative z-10 text-right font-semibold tabular-nums">
                      {preisMap.get(p.id)?.listenpreis != null ? (
                        <span className="text-primary">{preisMap.get(p.id)!.listenpreis!.toFixed(2)} €</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="pointer-events-none relative z-10 text-right font-mono tabular-nums text-muted-foreground">
                      {preisMap.get(p.id)?.ekLG != null
                        ? `${preisMap.get(p.id)!.ekLG!.toFixed(2)} €`
                        : "—"}
                    </TableCell>
                    <TableCell className="pointer-events-none relative z-10 text-right font-mono tabular-nums text-muted-foreground">
                      {preisMap.get(p.id)?.ekEK != null
                        ? `${preisMap.get(p.id)!.ekEK!.toFixed(2)} €`
                        : "—"}
                    </TableCell>
                    <TableCell className="pointer-events-none relative z-10">
                      {p.artikel_bearbeitet ? (
                        <span className="pill pill-ok">bearbeitet</span>
                      ) : (
                        <span className="pill pill-bad">unbearbeitet</span>
                      )}
                    </TableCell>
                    <TableCell className="relative z-20">
                      <Link
                        href={`/produkte/${p.id}`}
                        className="inline-flex items-center p-1 text-muted-foreground/50 transition-colors hover:text-primary"
                      >
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
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
    <div className={`relative overflow-hidden rounded-[10px] border border-border/60 bg-background ${className ?? ""}`}>
      {url ? (
        <Image src={url} alt="" fill sizes="400px" className="object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground/70">
          <span className="font-medium">{label}</span>
          <span className="text-[10px]">{size}</span>
        </div>
      )}
    </div>
  );
}
