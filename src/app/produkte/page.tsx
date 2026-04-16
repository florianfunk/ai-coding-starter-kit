import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

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

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Produkte</h1>
            <p className="text-muted-foreground">{count ?? 0} Produkte gefunden.</p>
          </div>
          <Button asChild>
            <Link href="/produkte/neu"><Plus className="mr-2 h-4 w-4" /> neues Produkt</Link>
          </Button>
        </div>

        <form className="grid gap-3 md:grid-cols-5 items-end p-3 rounded border bg-muted/30">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Suche (Artikelnr, Name, Titel)</label>
            <Input name="q" defaultValue={sp.q ?? ""} placeholder="z.B. BL13528" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Bereich</label>
            <select name="bereich" defaultValue={sp.bereich ?? ""} className="w-full rounded border px-2 py-2 bg-background">
              <option value="">Alle</option>
              {(bereiche ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Kategorie</label>
            <select name="kategorie" defaultValue={sp.kategorie ?? ""} className="w-full rounded border px-2 py-2 bg-background">
              <option value="">Alle</option>
              {filteredKategorien.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select name="status" defaultValue={sp.status ?? ""} className="w-full rounded border px-2 py-2 bg-background">
              <option value="">Alle</option>
              <option value="unbearbeitet">nur unbearbeitet</option>
              <option value="bearbeitet">nur bearbeitet</option>
            </select>
          </div>
          <div className="md:col-span-5 flex gap-2 justify-end">
            <Button asChild type="button" variant="ghost"><Link href="/produkte">Zurücksetzen</Link></Button>
            <Button type="submit">Anwenden</Button>
          </div>
        </form>

        <div className="rounded-md border bg-background overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artikelnummer</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Bereich</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Sortierung</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(produkte ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Keine Produkte gefunden.</TableCell>
                </TableRow>
              )}
              {(produkte ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/produkte/${p.id}`} className="font-mono text-sm hover:underline">{p.artikelnummer}</Link>
                  </TableCell>
                  <TableCell className="max-w-md truncate">{p.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{bereichName.get(p.bereich_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{kategorieName.get(p.kategorie_id) ?? "—"}</TableCell>
                  <TableCell className="text-right">{p.sortierung}</TableCell>
                  <TableCell>
                    {p.artikel_bearbeitet
                      ? <Badge variant="secondary">bearbeitet</Badge>
                      : <Badge variant="outline">unbearbeitet</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-end gap-2 text-sm">
            {page > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`?${new URLSearchParams({ ...sp, page: String(page - 1) }).toString()}`}>← zurück</Link>
              </Button>
            )}
            <span className="self-center text-muted-foreground">Seite {page} / {totalPages}</span>
            {page < totalPages && (
              <Button asChild variant="outline" size="sm">
                <Link href={`?${new URLSearchParams({ ...sp, page: String(page + 1) }).toString()}`}>weiter →</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
