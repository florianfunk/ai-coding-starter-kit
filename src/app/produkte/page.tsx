import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Filter, X } from "lucide-react";
import { ProdukteTableBody } from "./produkte-table-body";
import { calculateCompleteness, type CompletenessResult } from "@/lib/completeness";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ProdukteListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bereich?: string; kategorie?: string; status?: string; sort?: string; page?: string; vollstaendigkeit?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: bereiche }, { data: kategorien }] = await Promise.all([
    supabase.from("bereiche").select("id,name").order("sortierung"),
    supabase.from("kategorien").select("id,name,bereich_id").order("name"),
  ]);

  const page = Math.max(1, Number(sp.page ?? "1"));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("produkte").select("*", { count: "exact" });

  if (sp.q) {
    const q = sp.q.trim();
    query = query.or(`artikelnummer.ilike.%${q}%,name.ilike.%${q}%,datenblatt_titel.ilike.%${q}%`);
  }
  if (sp.bereich) query = query.eq("bereich_id", sp.bereich);
  if (sp.kategorie) query = query.eq("kategorie_id", sp.kategorie);
  if (sp.status === "unbearbeitet") query = query.eq("artikel_bearbeitet", false);
  if (sp.status === "bearbeitet") query = query.eq("artikel_bearbeitet", true);

  const sort = sp.sort ?? "artikelnummer";
  const [col, dir] = sort.startsWith("-") ? [sort.slice(1), "desc"] : [sort, "asc"];
  query = query.order(col, { ascending: dir === "asc" }).range(from, to);

  const { data: produkte, count } = await query;

  // Fetch completeness context for visible products
  const produktIds = (produkte ?? []).map((p) => p.id);
  let completenessMap: Record<string, CompletenessResult> = {};

  if (produktIds.length > 0) {
    const [{ data: activePreise }, { data: iconCounts }, { data: galerieCounts }] = await Promise.all([
      supabase.from("aktuelle_preise").select("produkt_id").in("produkt_id", produktIds),
      supabase.from("produkt_icons").select("produkt_id").in("produkt_id", produktIds),
      supabase.from("produkt_bilder").select("produkt_id").in("produkt_id", produktIds),
    ]);

    const priceSet = new Set((activePreise ?? []).map((r) => r.produkt_id));
    const iconCountMap: Record<string, number> = {};
    for (const r of iconCounts ?? []) {
      iconCountMap[r.produkt_id] = (iconCountMap[r.produkt_id] ?? 0) + 1;
    }
    const galerieCountMap: Record<string, number> = {};
    for (const r of galerieCounts ?? []) {
      galerieCountMap[r.produkt_id] = (galerieCountMap[r.produkt_id] ?? 0) + 1;
    }

    for (const p of produkte ?? []) {
      completenessMap[p.id] = calculateCompleteness(p, {
        hasActivePrice: priceSet.has(p.id),
        iconCount: iconCountMap[p.id] ?? 0,
        galerieCount: galerieCountMap[p.id] ?? 0,
      });
    }
  }

  // Filter by completeness (client-side since it's computed)
  let filteredProdukte = produkte ?? [];
  if (sp.vollstaendigkeit === "unvollstaendig") {
    filteredProdukte = filteredProdukte.filter((p) => (completenessMap[p.id]?.percent ?? 0) <= 80);
  } else if (sp.vollstaendigkeit === "vollstaendig") {
    filteredProdukte = filteredProdukte.filter((p) => (completenessMap[p.id]?.percent ?? 0) > 80);
  }

  const filteredKategorien = sp.bereich
    ? (kategorien ?? []).filter((k) => k.bereich_id === sp.bereich)
    : (kategorien ?? []);
  const bereichNameMap = Object.fromEntries((bereiche ?? []).map((b) => [b.id, b.name]));
  const kategorieNameMap = Object.fromEntries((kategorien ?? []).map((k) => [k.id, k.name]));

  const displayCount = sp.vollstaendigkeit ? filteredProdukte.length : (count ?? 0);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const hasFilter = Boolean(sp.q || sp.bereich || sp.kategorie || sp.status || sp.vollstaendigkeit);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Artikel"
        title="Produkte"
        subtitle={`${displayCount} Produkte${hasFilter ? " gefunden (Filter aktiv)" : ""}`}
      >
        <Button asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Link href="/produkte/neu">
            <Plus className="mr-2 h-4 w-4" /> Neues Produkt
          </Link>
        </Button>
      </PageHeader>

      {/* Filter */}
      <Card className="mb-4 border-2">
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-6 items-end">
            <div className="md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
                <Search className="h-3 w-3" /> Suche
              </label>
              <Input name="q" defaultValue={sp.q ?? ""} placeholder="Artikelnr, Name, Titel…" className="h-10" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Bereich</label>
              <select name="bereich" defaultValue={sp.bereich ?? ""} className="w-full h-10 rounded-lg border px-3 bg-background text-sm hover:border-primary/50 transition-colors">
                <option value="">Alle</option>
                {(bereiche ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Kategorie</label>
              <select name="kategorie" defaultValue={sp.kategorie ?? ""} className="w-full h-10 rounded-lg border px-3 bg-background text-sm hover:border-primary/50 transition-colors">
                <option value="">Alle</option>
                {filteredKategorien.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Status</label>
              <select name="status" defaultValue={sp.status ?? ""} className="w-full h-10 rounded-lg border px-3 bg-background text-sm hover:border-primary/50 transition-colors">
                <option value="">Alle</option>
                <option value="unbearbeitet">Unbearbeitet</option>
                <option value="bearbeitet">Bearbeitet</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 block">Vollstaendigkeit</label>
              <select name="vollstaendigkeit" defaultValue={sp.vollstaendigkeit ?? ""} className="w-full h-10 rounded-lg border px-3 bg-background text-sm hover:border-primary/50 transition-colors">
                <option value="">Alle</option>
                <option value="unvollstaendig">Unvollstaendig (&lt;80%)</option>
                <option value="vollstaendig">Vollstaendig (&gt;80%)</option>
              </select>
            </div>
            <div className="md:col-span-6 flex gap-2 justify-end border-t pt-3 mt-1">
              {hasFilter && (
                <Button asChild type="button" variant="ghost" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <Link href="/produkte"><X className="h-4 w-4 mr-1" /> Filter zurücksetzen</Link>
                </Button>
              )}
              <Button type="submit" className="shadow-sm">
                <Filter className="h-4 w-4 mr-1" /> Anwenden
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Tabelle */}
      <Card className="border-2">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
                <TableHead className="text-primary-foreground font-semibold">Artikelnummer</TableHead>
                <TableHead className="text-primary-foreground font-semibold">Name</TableHead>
                <TableHead className="text-primary-foreground font-semibold">Bereich</TableHead>
                <TableHead className="text-primary-foreground font-semibold">Kategorie</TableHead>
                <TableHead className="text-right text-primary-foreground font-semibold">Sort</TableHead>
                <TableHead className="text-primary-foreground font-semibold">Status</TableHead>
                <TableHead className="text-primary-foreground font-semibold min-w-[140px]">Vollstaendigkeit</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <ProdukteTableBody
              produkte={filteredProdukte.map((p) => ({
                id: p.id,
                artikelnummer: p.artikelnummer,
                name: p.name,
                bereich_id: p.bereich_id,
                kategorie_id: p.kategorie_id,
                sortierung: p.sortierung,
                artikel_bearbeitet: p.artikel_bearbeitet,
              }))}
              bereichName={bereichNameMap}
              kategorieName={kategorieNameMap}
              hasFilter={hasFilter}
              completenessMap={completenessMap}
            />
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-end gap-2 text-sm mt-4">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={`?${new URLSearchParams({ ...sp, page: String(page - 1) }).toString()}`}>← Zurück</Link>
            </Button>
          )}
          <span className="self-center text-muted-foreground px-2">
            Seite <span className="font-semibold text-foreground">{page}</span> von {totalPages}
          </span>
          {page < totalPages && (
            <Button asChild variant="outline" size="sm">
              <Link href={`?${new URLSearchParams({ ...sp, page: String(page + 1) }).toString()}`}>Weiter →</Link>
            </Button>
          )}
        </div>
      )}
    </AppShell>
  );
}
