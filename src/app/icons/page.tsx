import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Info, Sparkles, Palette } from "lucide-react";
import { DeleteIconButton } from "./delete-button";
import { EmptyState } from "@/components/empty-state";

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
      <PageHeader
        eyebrow="Sammlung"
        title="Icons"
        subtitle={`${withUrls.length} Icons zur Auswahl`}
      >
        <Button asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Link href="/icons/neu">
            <Plus className="mr-2 h-4 w-4" /> Neues Icon
          </Link>
        </Button>
      </PageHeader>

      <Alert className="mb-5 border-accent/50 bg-accent/10">
        <Info className="h-4 w-4 text-accent-foreground" />
        <AlertDescription className="text-sm">
          <strong>Format:</strong> PNG, SVG oder PDF in <strong>240×240 Pixel</strong> (Rahmen 8 pt). Icons werden in Kategorien und Produkten als Auswahl angezeigt.
        </AlertDescription>
      </Alert>

      <Card className="border-2">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
                <TableHead className="w-12 text-primary-foreground font-semibold">#</TableHead>
                <TableHead className="text-primary-foreground font-semibold">Name</TableHead>
                <TableHead className="text-primary-foreground font-semibold">Gruppe</TableHead>
                <TableHead className="text-right w-24 text-primary-foreground font-semibold">Sortierung</TableHead>
                <TableHead className="w-24 text-primary-foreground font-semibold">Bild</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {withUrls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8">
                    <EmptyState
                      icon={Palette}
                      title="Keine Icons"
                      description="Laden Sie Icons hoch, um sie in Kategorien und Produkten zu verwenden."
                      actionLabel="Icon anlegen"
                      actionHref="/icons/neu"
                    />
                  </TableCell>
                </TableRow>
              )}
              {withUrls.map((ic, i) => (
                <TableRow key={ic.id} className="group row-hover">
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-semibold">{ic.label}</TableCell>
                  <TableCell>
                    {ic.gruppe
                      ? <span className="text-sm text-muted-foreground">{ic.gruppe}</span>
                      : <span className="text-xs italic text-muted-foreground/50">ohne Gruppe</span>}
                  </TableCell>
                  <TableCell className="text-right">{ic.sortierung}</TableCell>
                  <TableCell>
                    <div className="h-12 w-12 rounded-lg border-2 bg-background flex items-center justify-center overflow-hidden">
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
                      <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
                        <Link href={`/icons/${ic.id}`}>
                          <Pencil className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Bearbeiten</span>
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
    </AppShell>
  );
}
