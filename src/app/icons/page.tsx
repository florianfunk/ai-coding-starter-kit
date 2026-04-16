import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Info } from "lucide-react";
import { DeleteIconButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function IconsPage() {
  const supabase = await createClient();
  const { data: icons } = await supabase
    .from("icons")
    .select("*")
    .order("gruppe", { ascending: true, nullsFirst: false })
    .order("sortierung")
    .order("label");

  const withUrls = await Promise.all(
    (icons ?? []).map(async (ic) => ({
      ...ic,
      url: await getSignedUrl("produktbilder", ic.symbol_path),
    })),
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Icons</h1>
            <p className="text-muted-foreground mt-1">{withUrls.length} Icons in der Sammlung</p>
          </div>
          <Button asChild size="lg">
            <Link href="/icons/neu">
              <Plus className="mr-2 h-4 w-4" /> Neues Icon
            </Link>
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Bitte die Icons als <strong>PNG, SVG oder PDF</strong> in der Größe <strong>240×240 Pixel</strong> anlegen.
            Der Rahmen ist auf 8 pt festgelegt. Icons werden in Kategorien und Produkten als Dropdown-Auswahl angezeigt.
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Gruppe</TableHead>
                  <TableHead className="text-right w-24">Sortierung</TableHead>
                  <TableHead className="w-24">Bild</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {withUrls.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      Noch keine Icons. Lege welche an, um sie in Kategorien/Produkten zu verwenden.
                    </TableCell>
                  </TableRow>
                )}
                {withUrls.map((ic, i) => (
                  <TableRow key={ic.id} className="group">
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-semibold">{ic.label}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {ic.gruppe ?? <span className="italic">—</span>}
                    </TableCell>
                    <TableCell className="text-right">{ic.sortierung}</TableCell>
                    <TableCell>
                      <div className="h-12 w-12 rounded-lg border bg-background flex items-center justify-center overflow-hidden">
                        {ic.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ic.url} alt={ic.label} className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">{ic.label.slice(0, 4)}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5 justify-end">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/icons/${ic.id}`}>
                            <Pencil className="h-4 w-4 mr-1" /> Bearbeiten
                          </Link>
                        </Button>
                        <DeleteIconButton id={ic.id} name={ic.label} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
