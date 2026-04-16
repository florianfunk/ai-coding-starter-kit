import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Pencil, Copy, ChevronRight, Lock } from "lucide-react";
import { DeleteTemplateButton } from "./delete-button";
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Datenblatt-Vorlagen</h1>
            <p className="text-muted-foreground mt-1">
              Layouts mit Slots für Bilder, Cutting-Diagramme und Energielabel.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/datenblatt-vorlagen/neu">
              <Plus className="mr-2 h-4 w-4" /> Neue Vorlage
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(templates ?? []).map((t: any) => (
            <Card key={t.id} className="group hover:shadow-md hover:border-primary/30 transition-all">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {t.is_system && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <h3 className="font-semibold truncate">{t.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {t.is_system ? <Badge variant="secondary" className="text-[10px]">System</Badge> : <Badge variant="outline" className="text-[10px]">Custom</Badge>}
                      <span>{(t.slots as Slot[]).length} Slots</span>
                      <span>{t.page_width_cm}×{t.page_height_cm} cm</span>
                    </div>
                  </div>
                </div>

                {/* Mini Preview */}
                <Link href={`/datenblatt-vorlagen/${t.id}`}>
                  <TemplatePreview
                    pageWidth={Number(t.page_width_cm)}
                    pageHeight={Number(t.page_height_cm)}
                    slots={t.slots as Slot[]}
                    targetWidthPx={280}
                  />
                </Link>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex gap-1">
                    <DuplicateButton id={t.id} />
                    {!t.is_system && <DeleteTemplateButton id={t.id} name={t.name} />}
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/datenblatt-vorlagen/${t.id}`}>
                      {t.is_system ? "Ansehen" : <><Pencil className="h-3.5 w-3.5 mr-1" />Bearbeiten</>}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {(templates ?? []).length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
              Noch keine Vorlagen.
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
