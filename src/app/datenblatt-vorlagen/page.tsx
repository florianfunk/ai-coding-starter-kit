import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Pencil, ChevronRight, Lock, LayoutTemplate } from "lucide-react";
import { DeleteTemplateButton } from "./delete-button";
import { EmptyState } from "@/components/empty-state";
import { DuplicateButton } from "./duplicate-button";
import { TemplatePreview } from "./template-preview";
import type { Slot } from "@/lib/datenblatt";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("datenblatt_templates")
    .select("*")
    .order("is_system", { ascending: false })
    .order("sortierung");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Layout"
        title="Datenblatt-Vorlagen"
        subtitle="Layouts mit Slots für Bilder, Cutting-Diagramme und Energielabel"
      >
        <Button asChild size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Link href="/datenblatt-vorlagen/neu">
            <Plus className="mr-2 h-4 w-4" /> Neue Vorlage
          </Link>
        </Button>
      </PageHeader>

      {(templates ?? []).length === 0 && (
        <EmptyState
          icon={FileText}
          title="Keine Vorlagen"
          description="Erstellen Sie eine Datenblatt-Vorlage mit Slots fuer Bilder, Diagramme und Energielabel."
          actionLabel="Vorlage anlegen"
          actionHref="/datenblatt-vorlagen/neu"
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(templates ?? []).map((t: any) => (
          <Card key={t.id} className="group card-hover border-2 flex flex-col">
            <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {t.is_system
                    ? <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
                    : <FileText className="h-3.5 w-3.5 text-accent shrink-0" />
                  }
                  <h3 className="font-semibold truncate flex-1 group-hover:text-primary transition-colors">{t.name}</h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {t.is_system
                    ? <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px]">System</Badge>
                    : <Badge className="bg-accent/20 text-accent-foreground hover:bg-accent/30 text-[10px]">Custom</Badge>}
                  <span className="text-muted-foreground">{(t.slots as Slot[]).length} Slots</span>
                  <span className="text-muted-foreground">· {t.page_width_cm}×{t.page_height_cm} cm</span>
                </div>
              </div>

              <Link href={`/datenblatt-vorlagen/${t.id}`} className="block mx-auto transition-transform hover:scale-[1.02]">
                <TemplatePreview
                  pageWidth={Number(t.page_width_cm)}
                  pageHeight={Number(t.page_height_cm)}
                  slots={t.slots as Slot[]}
                  targetWidthPx={260}
                />
              </Link>

              <div className="flex items-center justify-between pt-2 border-t mt-auto">
                <div className="flex gap-0.5">
                  <DuplicateButton id={t.id} />
                  {!t.is_system && <DeleteTemplateButton id={t.id} name={t.name} />}
                </div>
                <Button asChild size="sm" variant="ghost" className="hover:bg-primary/10 hover:text-primary">
                  <Link href={`/datenblatt-vorlagen/${t.id}`}>
                    {t.is_system
                      ? "Ansehen"
                      : <><Pencil className="h-3.5 w-3.5 mr-1" />Bearbeiten</>}
                    <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
