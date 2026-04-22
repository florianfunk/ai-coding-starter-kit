import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Info, Palette, ChevronRight } from "lucide-react";
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
      <div className="flex flex-col gap-4">
        <div>
          <div className="crumbs">
            <Link href="/">Dashboard</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Assets</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Icons</span>
          </div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display-lg">Icons</h1>
              <p className="mt-2 max-w-[560px] text-[15px] text-muted-foreground">
                {withUrls.length} Icons zur Auswahl für Kategorien und Produkte. Format: PNG/SVG/PDF in 240×240 Pixel mit 8 pt Rahmen.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/icons/neu">
                <Plus className="h-3.5 w-3.5" /> Neues Icon
              </Link>
            </Button>
          </div>
        </div>

        <div className="glass-card flex items-start gap-3 p-4 text-[13px]">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-primary/10 text-primary">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <strong className="font-semibold">Format:</strong> PNG, SVG oder PDF in{" "}
            <strong className="font-semibold">240×240 Pixel</strong> (Rahmen 8 pt). Icons werden in Kategorien und Produkten als Auswahl angezeigt.
          </div>
        </div>

        {withUrls.length === 0 ? (
          <EmptyState
            icon={Palette}
            title="Keine Icons"
            description="Laden Sie Icons hoch, um sie in Kategorien und Produkten zu verwenden."
            actionLabel="Icon anlegen"
            actionHref="/icons/neu"
          />
        ) : (
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 pl-5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    #
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Name
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Gruppe
                  </TableHead>
                  <TableHead className="w-24 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Sortierung
                  </TableHead>
                  <TableHead className="w-24 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Bild
                  </TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {withUrls.map((ic, i) => (
                  <TableRow key={ic.id} className="group border-border/60">
                    <TableCell className="pl-5 font-mono text-[11.5px] text-muted-foreground/70 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </TableCell>
                    <TableCell className="font-medium">{ic.label}</TableCell>
                    <TableCell>
                      {ic.gruppe ? (
                        <span className="text-sm text-muted-foreground">{ic.gruppe}</span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground/50">ohne Gruppe</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[12.5px] tabular-nums text-muted-foreground">
                      {ic.sortierung}
                    </TableCell>
                    <TableCell>
                      <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-[10px] border border-border/60 bg-muted">
                        {ic.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ic.url} alt={ic.label} className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">{ic.label.slice(0, 4)}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/icons/${ic.id}`}>
                            <Pencil className="h-3.5 w-3.5 sm:mr-1" />
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
          </div>
        )}
      </div>
    </AppShell>
  );
}
