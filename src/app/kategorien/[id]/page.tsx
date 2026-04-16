import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, Pencil, ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function KategorieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: kategorie } = await supabase.from("kategorien").select("*").eq("id", id).single();
  if (!kategorie) notFound();

  const [{ data: bereich }, { data: produkte }, { data: iconLinks }] = await Promise.all([
    supabase.from("bereiche").select("id,name").eq("id", kategorie.bereich_id).single(),
    supabase.from("produkte").select("*").eq("kategorie_id", id).order("sortierung"),
    supabase.from("kategorie_icons").select("icons(label)").eq("kategorie_id", id),
  ]);

  const vorschaubildUrl = await getSignedUrl("produktbilder", kategorie.vorschaubild_path);
  const iconLabels = ((iconLinks ?? []) as any[]).map((r) => r.icons?.label).filter(Boolean) as string[];

  const produkteMitBild = await Promise.all(
    (produkte ?? []).map(async (p) => ({
      ...p,
      hauptbild_url: await getSignedUrl("produktbilder", p.hauptbild_path),
    })),
  );

  // Current prices for all products
  const prodIds = produkteMitBild.map((p) => p.id);
  const { data: preise } = prodIds.length
    ? await supabase.from("aktuelle_preise").select("produkt_id, listenpreis").in("produkt_id", prodIds)
    : { data: [] };
  const preisMap = new Map<string, number>();
  for (const p of preise ?? []) preisMap.set(p.produkt_id, Number(p.listenpreis));

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href={`/bereiche/${kategorie.bereich_id}`}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Zurück zu {bereich?.name ?? "Bereich"}
            </Link>
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {vorschaubildUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vorschaubildUrl} alt="" className="h-16 w-24 rounded-lg object-cover border" />
              )}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {bereich?.name} &middot; Kategorie
                </p>
                <h1 className="text-3xl font-bold tracking-tight">{kategorie.name}</h1>
                {kategorie.beschreibung && (
                  <p className="text-muted-foreground mt-1 max-w-2xl">{kategorie.beschreibung}</p>
                )}
                {iconLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {iconLabels.map((l) => (
                      <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href={`/kategorien/${id}/bearbeiten`}>
                  <Pencil className="h-4 w-4 mr-1" /> Kategorie bearbeiten
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/produkte/neu?kategorie=${id}`}>
                  <Plus className="h-4 w-4 mr-1" /> Neues Produkt
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">Produkte ({produkteMitBild.length})</h2>

          {produkteMitBild.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Noch keine Produkte in dieser Kategorie.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">Bild</TableHead>
                      <TableHead>Artikelnummer</TableHead>
                      <TableHead>Bezeichnung</TableHead>
                      <TableHead className="text-right">Sortierung</TableHead>
                      <TableHead className="text-right">Listenpreis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produkteMitBild.map((p) => (
                      <TableRow key={p.id} className="group">
                        <TableCell>
                          {p.hauptbild_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.hauptbild_url} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/produkte/${p.id}`} className="font-mono text-sm hover:text-primary hover:underline">
                            {p.artikelnummer}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate">{p.name ?? "—"}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm">{p.sortierung}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {preisMap.has(p.id) ? `${preisMap.get(p.id)!.toFixed(2)} €` : "—"}
                        </TableCell>
                        <TableCell>
                          {p.artikel_bearbeitet
                            ? <Badge variant="secondary" className="text-xs">bearbeitet</Badge>
                            : <Badge variant="outline" className="text-xs">unbearbeitet</Badge>}
                        </TableCell>
                        <TableCell>
                          <Link href={`/produkte/${p.id}`} className="inline-flex items-center text-muted-foreground group-hover:text-primary transition">
                            <ChevronRight className="h-5 w-5" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
