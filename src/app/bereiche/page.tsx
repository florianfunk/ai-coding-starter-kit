import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { DeleteBereichButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function BereichePage() {
  const supabase = await createClient();
  const { data: bereiche } = await supabase
    .from("bereiche")
    .select("*")
    .order("sortierung", { ascending: true })
    .limit(500);

  // Counts per bereich
  const ids = (bereiche ?? []).map((b) => b.id);
  const { data: katStats } = ids.length
    ? await supabase.from("kategorien").select("bereich_id").in("bereich_id", ids).limit(5000)
    : { data: [] };
  const { data: prodStats } = ids.length
    ? await supabase.from("produkte").select("bereich_id").in("bereich_id", ids).limit(5000)
    : { data: [] };

  const katCount = new Map<string, number>();
  for (const r of katStats ?? []) katCount.set(r.bereich_id, (katCount.get(r.bereich_id) ?? 0) + 1);
  const prodCount = new Map<string, number>();
  for (const r of prodStats ?? []) prodCount.set(r.bereich_id, (prodCount.get(r.bereich_id) ?? 0) + 1);

  // Signed URLs for bilder
  const withUrls = await Promise.all(
    (bereiche ?? []).map(async (b) => ({
      ...b,
      bild_url: await getSignedUrl("produktbilder", b.bild_path),
    })),
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Bereiche</h1>
            <p className="text-muted-foreground">{withUrls.length} Bereiche im Katalog.</p>
          </div>
          <Button asChild>
            <Link href="/bereiche/neu">
              <Plus className="mr-2 h-4 w-4" /> neuer Bereich
            </Link>
          </Button>
        </div>

        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Kategorien</TableHead>
                <TableHead className="text-right">Produkte</TableHead>
                <TableHead className="text-right">Sortierung</TableHead>
                <TableHead className="text-right">Seitenzahl</TableHead>
                <TableHead className="text-right">Startseite</TableHead>
                <TableHead>Bild</TableHead>
                <TableHead className="text-right w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {withUrls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    Noch keine Bereiche angelegt.
                  </TableCell>
                </TableRow>
              )}
              {withUrls.map((b, i) => (
                <TableRow key={b.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <Link href={`/bereiche/${b.id}/bearbeiten`} className="font-medium hover:underline">
                      {b.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{katCount.get(b.id) ?? 0}</TableCell>
                  <TableCell className="text-right">{prodCount.get(b.id) ?? 0}</TableCell>
                  <TableCell className="text-right">{b.sortierung}</TableCell>
                  <TableCell className="text-right">{b.seitenzahl ?? "—"}</TableCell>
                  <TableCell className="text-right">{b.startseite ?? "—"}</TableCell>
                  <TableCell>
                    {b.bild_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.bild_url} alt="" className="h-10 w-16 rounded object-cover" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteBereichButton id={b.id} name={b.name} />
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
