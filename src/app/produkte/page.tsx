import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, ChevronRight, Search, Filter, X } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ProdukteListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bereich?: string; kategorie?: string; status?: string; sort?: string; page?: string }>;
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

  const filteredKategorien = sp.bereich
    ? (kategorien ?? []).filter((k) => k.bereich_id === sp.bereich)
    : (kategorien ?? []);
  const bereichName = new Map((bereiche ?? []).map((b) => [b.id, b.name]));
  const kategorieName = new Map((kategorien ?? []).map((k) => [k.id, k.name]));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const hasFilter = Boolean(sp.q || sp.bereich || sp.kategorie || sp.status);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Artikel"
        title="Produkte"
        subtitle={`${count ?? 0} Produkte${hasFilter ? " gefunden (Filter aktiv)" : ""}`}
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
          <form className="grid gap-3 md:grid-cols-5 items-end">
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
            <div className="md:col-span-5 flex gap-2 justify-end border-t pt-3 mt-1">
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
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(produkte ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    {hasFilter ? "Keine Produkte entsprechen deinem Filter" : "Noch keine Produkte angelegt"}
                  </TableCell>
                </TableRow>
              )}
              {(produkte ?? []).map((p) => (
                <TableRow key={p.id} className="group relative row-hover">
                  <TableCell>
                    <Link href={`/produkte/${p.id}`} className="absolute inset-0 z-0" />
                    <span className="relative z-10 pointer-events-none font-mono text-sm group-hover:text-primary transition-colors">
                      {p.artikelnummer}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-md truncate relative z-10 pointer-events-none">{p.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm relative z-10 pointer-events-none">{bereichName.get(p.bereich_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm relative z-10 pointer-events-none">{kategorieName.get(p.kategorie_id) ?? "—"}</TableCell>
                  <TableCell className="text-right relative z-10 pointer-events-none">{p.sortierung}</TableCell>
                  <TableCell className="relative z-10 pointer-events-none">
                    {p.artikel_bearbeitet
                      ? <Badge className="bg-success text-success-foreground hover:bg-success text-[10px]">bearbeitet</Badge>
                      : <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">unbearbeitet</Badge>}
                  </TableCell>
                  <TableCell className="relative z-20">
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
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
