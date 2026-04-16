import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { DeleteKategorieButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function KategorienPage({
  searchParams,
}: {
  searchParams: Promise<{ bereich?: string }>;
}) {
  const { bereich } = await searchParams;
  const supabase = await createClient();

  const { data: bereiche } = await supabase.from("bereiche").select("id,name").order("sortierung");

  let q = supabase.from("kategorien").select("*").order("sortierung").limit(1000);
  if (bereich) q = q.eq("bereich_id", bereich);
  const { data: kategorien } = await q;

  const ids = (kategorien ?? []).map((k) => k.id);
  const { data: prodStats } = ids.length
    ? await supabase.from("produkte").select("kategorie_id").in("kategorie_id", ids).limit(5000)
    : { data: [] };
  const prodCount = new Map<string, number>();
  for (const r of prodStats ?? []) prodCount.set(r.kategorie_id, (prodCount.get(r.kategorie_id) ?? 0) + 1);

  const { data: iconLinks } = ids.length
    ? await supabase
        .from("kategorie_icons")
        .select("kategorie_id, icons(label)")
        .in("kategorie_id", ids)
    : { data: [] };
  const iconsByKat = new Map<string, string[]>();
  for (const r of (iconLinks ?? []) as any[]) {
    const arr = iconsByKat.get(r.kategorie_id) ?? [];
    if (r.icons?.label) arr.push(r.icons.label);
    iconsByKat.set(r.kategorie_id, arr);
  }

  const bereichName = new Map((bereiche ?? []).map((b) => [b.id, b.name]));

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Kategorien</h1>
            <p className="text-muted-foreground">{(kategorien ?? []).length} Kategorien.</p>
          </div>
          <Button asChild>
            <Link href="/kategorien/neu">
              <Plus className="mr-2 h-4 w-4" /> neue Kategorie
            </Link>
          </Button>
        </div>

        <form className="flex gap-2 items-center text-sm">
          <label htmlFor="bereich" className="text-muted-foreground">Filter Bereich:</label>
          <select
            id="bereich"
            name="bereich"
            defaultValue={bereich ?? ""}
            className="rounded border px-2 py-1"
          >
            <option value="">Alle</option>
            {(bereiche ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <Button type="submit" size="sm" variant="outline">Anwenden</Button>
        </form>

        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Bereich</TableHead>
                <TableHead className="text-right">Produkte</TableHead>
                <TableHead className="text-right">Sortierung</TableHead>
                <TableHead>Icons</TableHead>
                <TableHead className="text-right w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(kategorien ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    Keine Kategorien.
                  </TableCell>
                </TableRow>
              )}
              {(kategorien ?? []).map((k, i) => (
                <TableRow key={k.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <Link href={`/kategorien/${k.id}/bearbeiten`} className="font-medium hover:underline">
                      {k.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{bereichName.get(k.bereich_id) ?? "—"}</TableCell>
                  <TableCell className="text-right">{prodCount.get(k.id) ?? 0}</TableCell>
                  <TableCell className="text-right">{k.sortierung}</TableCell>
                  <TableCell className="space-x-1">
                    {(iconsByKat.get(k.id) ?? []).slice(0, 6).map((l) => (
                      <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                    ))}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteKategorieButton id={k.id} name={k.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
