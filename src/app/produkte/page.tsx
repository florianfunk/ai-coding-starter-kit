import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, X, Upload, ChevronRight, LayoutList, ListTree } from "lucide-react";
import { ProdukteTable } from "./produkte-table-body";
import { ProdukteHierarchie } from "./produkte-hierarchie";
import { ExportDialog } from "./export-dialog";
import { KatalogDruckenDialog } from "@/components/katalog-drucken/katalog-drucken-dialog";
import { calculateCompleteness, type CompletenessResult } from "@/lib/completeness";
import { getBereiche, getKategorien, getKatalogTree } from "@/lib/cache";
import type { ProduktListing } from "@/lib/types/views";

const PAGE_SIZE = 50;

export default async function ProdukteListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bereich?: string; kategorie?: string; status?: string; sort?: string; page?: string; vollstaendigkeit?: string; ansicht?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ansicht: "hierarchie" | "liste" = sp.ansicht === "liste" ? "liste" : "hierarchie";

  // Bereiche & Kategorien aus dem Cache — slowly-changing, per Tag invalidiert.
  // KatalogTree + Wechselkurs nur für den Druck-Wizard (PROJ-37).
  const [bereiche, kategorien, katalogTree, einstellungen] = await Promise.all([
    getBereiche(),
    getKategorien(),
    getKatalogTree(),
    supabase.from("katalog_einstellungen").select("wechselkurs_eur_chf").eq("id", 1).single(),
  ]);
  const wechselkurs = Number(einstellungen.data?.wechselkurs_eur_chf ?? 1);

  const page = Math.max(1, Number(sp.page ?? "1"));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Konsolidierte View: produkte + bereich_name + kategorie_name + hat_preis + icon_count + galerie_count + completeness.
  // count "estimated" nutzt pg_class statistics statt full table scan — viel schneller bei großen Listen.
  let query = supabase.from("v_produkt_listing").select("*", { count: "estimated" });

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
  query = query.order(col, { ascending: dir === "asc" });
  // In der Hierarchie-Ansicht alle Produkte laden (gruppiert dargestellt, keine Pagination).
  if (ansicht === "liste") {
    query = query.range(from, to);
  }

  const { data: produkte, count } = await query;
  const listing = (produkte ?? []) as ProduktListing[];

  // Completeness-Objekt pro Row aus den View-Feldern rekonstruieren (keine Extra-Queries).
  // Die MV liefert nur percent/is_complete; für den Tooltip brauchen wir aber die Liste
  // der fehlenden Felder. Die bauen wir rein in-memory mit calculateCompleteness.
  const completenessMap: Record<string, CompletenessResult> = {};
  for (const p of listing) {
    completenessMap[p.id] = calculateCompleteness(p as any, {
      hasActivePrice: Boolean(p.hat_preis),
      iconCount: p.icon_count ?? 0,
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
      <div className="flex flex-col gap-4">
        <div>
          <div className="crumbs">
            <Link href="/">Dashboard</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Katalog</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Produkte</span>
          </div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display-lg">Produkte</h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                {displayCount} Produkte{hasFilter ? " gefunden · Filter aktiv" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-[9px] border border-border/70 bg-card p-0.5">
                <Link
                  href={`?${new URLSearchParams({ ...(sp as Record<string, string>), ansicht: "hierarchie" }).toString()}`}
                  className={`inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    ansicht === "hierarchie" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={ansicht === "hierarchie"}
                >
                  <ListTree className="h-3.5 w-3.5" /> Hierarchie
                </Link>
                <Link
                  href={`?${new URLSearchParams({ ...(sp as Record<string, string>), ansicht: "liste" }).toString()}`}
                  className={`inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    ansicht === "liste" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={ansicht === "liste"}
                >
                  <LayoutList className="h-3.5 w-3.5" /> Liste
                </Link>
              </div>
              <KatalogDruckenDialog tree={katalogTree} wechselkurs={wechselkurs} />
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
              <Button asChild variant="outline" size="sm">
                <Link href="/produkte/import">
                  <Upload className="h-3.5 w-3.5" /> Preise importieren
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/produkte/neu">
                  <Plus className="h-3.5 w-3.5" /> Neues Produkt
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <form className="glass-card grid items-end gap-3 p-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
              <Search className="h-3 w-3" /> Suche
            </label>
            <Input name="q" defaultValue={sp.q ?? ""} placeholder="Artikelnr, Name, Titel…" />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
              Bereich
            </label>
            <select
              name="bereich"
              defaultValue={sp.bereich ?? ""}
              className="h-[34px] w-full rounded-[9px] border border-border/70 bg-card px-3 text-[13.5px]"
            >
              <option value="">Alle</option>
              {bereiche.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
              Kategorie
            </label>
            <select
              name="kategorie"
              defaultValue={sp.kategorie ?? ""}
              className="h-[34px] w-full rounded-[9px] border border-border/70 bg-card px-3 text-[13.5px]"
            >
              <option value="">Alle</option>
              {filteredKategorien.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
              Status
            </label>
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className="h-[34px] w-full rounded-[9px] border border-border/70 bg-card px-3 text-[13.5px]"
            >
              <option value="">Alle</option>
              <option value="unbearbeitet">Unbearbeitet</option>
              <option value="bearbeitet">Bearbeitet</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
              Vollständigkeit
            </label>
            <select
              name="vollstaendigkeit"
              defaultValue={sp.vollstaendigkeit ?? ""}
              className="h-[34px] w-full rounded-[9px] border border-border/70 bg-card px-3 text-[13.5px]"
            >
              <option value="">Alle</option>
              <option value="unvollstaendig">Unvollständig (&lt;80%)</option>
              <option value="vollstaendig">Vollständig (&gt;80%)</option>
            </select>
          </div>
          <div className="mt-1 flex justify-end gap-2 border-t border-border/60 pt-3 md:col-span-6">
            {hasFilter && (
              <Button asChild type="button" variant="ghost" size="sm">
                <Link href="/produkte">
                  <X className="h-3.5 w-3.5" /> Filter zurücksetzen
                </Link>
              </Button>
            )}
            <Button type="submit" size="sm">
              <Filter className="h-3.5 w-3.5" /> Anwenden
            </Button>
          </div>
        </form>

        <div className="glass-card overflow-hidden">
          {ansicht === "hierarchie" ? (
            <ProdukteHierarchie
              produkte={listing.map((p) => ({
                id: p.id,
                artikelnummer: p.artikelnummer,
                name: p.name,
                bereich_id: p.bereich_id,
                kategorie_id: p.kategorie_id,
                hauptbild_path: p.hauptbild_path,
                artikel_bearbeitet: p.artikel_bearbeitet,
              }))}
              bereiche={bereiche.map((b) => ({ id: b.id, name: b.name }))}
              kategorien={kategorien.map((k) => ({ id: k.id, name: k.name, bereich_id: k.bereich_id }))}
              completenessMap={completenessMap}
              hasFilter={hasFilter}
            />
          ) : (
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
          )}
        </div>

        {ansicht === "liste" && totalPages > 1 && (
          <div className="mt-2 flex justify-end gap-2 text-sm">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`?${new URLSearchParams({ ...sp, page: String(page - 1) }).toString()}`}>
                  ← Zurück
                </Link>
              </Button>
            )}
            <span className="self-center px-2 text-muted-foreground">
              Seite <span className="font-semibold text-foreground">{page}</span> von {totalPages}
            </span>
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`?${new URLSearchParams({ ...sp, page: String(page + 1) }).toString()}`}>
                  Weiter →
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
