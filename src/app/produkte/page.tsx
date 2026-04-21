import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Filter, X, Upload } from "lucide-react";
import { ProdukteTable } from "./produkte-table-body";
import { ExportDialog } from "./export-dialog";
import { calculateCompleteness, type CompletenessResult } from "@/lib/completeness";
import { getBereiche, getKategorien } from "@/lib/cache";
import type { ProduktListing } from "@/lib/types/views";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ProdukteListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bereich?: string; kategorie?: string; status?: string; sort?: string; page?: string; vollstaendigkeit?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  // Bereiche & Kategorien aus dem Cache — slowly-changing, per Tag invalidiert.
  const [bereiche, kategorien] = await Promise.all([
    getBereiche(),
    getKategorien(),
  ]);

  const page = Math.max(1, Number(sp.page ?? "1"));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Konsolidierte View: produkte + bereich_name + kategorie_name + hat_preis + icon_count + galerie_count + completeness.
  let query = supabase.from("v_produkt_listing").select("*", { count: "exact" });

  if (sp.q) {
    const q = sp.q.trim();
    query = query.or(`artikelnummer.ilike.%${q}%,name.ilike.%${q}%,datenblatt_titel.ilike.%${q}%`);
  }
  if (sp.bereich) query = query.eq("bereich_id", sp.bereich);
  if (sp.kategorie) query = query.eq("kategorie_id", sp.kategorie);
  if (sp.status === "unbearbeitet") query = query.eq("artikel_bearbeitet", false);
  if (sp.status === "bearbeitet") query = query.eq("artikel_bearbeitet", true);

  // Vollstaendigkeits-Filter serverseitig (spart clientseitiges Filtern + Pagination-Skew).
  if (sp.vollstaendigkeit === "unvollstaendig") query = query.lte("completeness_percent", 80);
  if (sp.vollstaendigkeit === "vollstaendig")   query = query.gt("completeness_percent", 80);

  const sort = sp.sort ?? "artikelnummer";
  const [col, dir] = sort.startsWith("-") ? [sort.slice(1), "desc"] : [sort, "asc"];
  query = query.order(col, { ascending: dir === "asc" }).range(from, to);

  const { data: produkte, count } = await query;
  const listing = (produkte ?? []) as ProduktListing[];

  // Completeness-Objekt pro Row aus den View-Feldern rekonstruieren (keine Extra-Queries).
  // Die MV liefert nur percent/is_complete; für den Tooltip brauchen wir aber die Liste
  // der fehlenden Felder. Die bauen wir rein in-memory mit calculateCompleteness, wobei
  // Kontext (hasActivePrice, iconCount, galerieCount) aus der View kommt.
  const completenessMap: Record<string, CompletenessResult> = {};
  for (const p of listing) {
    completenessMap[p.id] = calculateCompleteness(p as any, {
      hasActivePrice: Boolean(p.hat_preis),
      iconCount: p.icon_count ?? 0,
      galerieCount: p.galerie_count ?? 0,
    });
  }

  const filteredKategorien = sp.bereich
    ? kategorien.filter((k) => k.bereich_id === sp.bereich)
    : kategorien;
  const bereichNameMap = Object.fromEntries(bereiche.map((b) => [b.id, b.name]));
  const kategorieNameMap = Object.fromEntries(kategorien.map((k) => [k.id, k.name]));

  const displayCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const hasFilter = Boolean(sp.q || sp.bereich || sp.kategorie || sp.status || sp.vollstaendigkeit);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Artikel"
        title="Produkte"
        subtitle={`${displayCount} Produkte${hasFilter ? " gefunden (Filter aktiv)" : ""}`}
      >
        <div className="flex gap-2">
          <ExportDialog
            produktCount={displayCount}
            filters={{
              search: sp.q,
              bereichId: sp.bereich,
              kategorieId: sp.kategorie,
              status: sp.status,
              vollstaendigkeit: sp.vollstaendigkeit,
            }}
          />
          <Button asChild variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow">
            <Link href="/produkte/import">
              <Upload className="mr-2 h-4 w-4" /> Preise importieren
            </Link>
          </Button>
          <Button asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
            <Link href="/produkte/neu">
              <Plus className="mr-2 h-4 w-4" /> Neues Produkt
            </Link>
          </Button>
        </div>
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
                {bereiche.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
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
          <ProdukteTable
            produkte={listing.map((p) => ({
              id: p.id,
              artikelnummer: p.artikelnummer,
              name: p.name,
              bereich_id: p.bereich_id,
              kategorie_id: p.kategorie_id,
              sortierung: p.sortierung,
              artikel_bearbeitet: p.artikel_bearbeitet,
              hauptbild_path: p.hauptbild_path,
            }))}
            bereichName={bereichNameMap}
            kategorieName={kategorieNameMap}
            kategorien={kategorien.map((k) => ({ id: k.id, name: k.name }))}
            hasFilter={hasFilter}
            completenessMap={completenessMap}
          />
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
