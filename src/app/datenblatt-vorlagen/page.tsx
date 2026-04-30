import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Pencil, ChevronRight, Lock } from "lucide-react";
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
      <div className="flex flex-col gap-4">
        <div>
          <div className="crumbs">
            <Link href="/">Dashboard</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Assets</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Datenblatt-Vorlagen</span>
          </div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="display-lg">Datenblatt-Vorlagen</h1>
              <p className="mt-2 max-w-[560px] text-[15px] text-muted-foreground">
                Layouts mit Slots für Bilder, Cutting-Diagramme und Energielabel.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/datenblatt-vorlagen/neu">
                <Plus className="h-3.5 w-3.5" /> Neue Vorlage
              </Link>
            </Button>
          </div>
        </div>

        {(templates ?? []).length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Keine Vorlagen"
            description="Erstellen Sie eine Datenblatt-Vorlage mit Slots für Bilder, Diagramme und Energielabel."
            actionLabel="Vorlage anlegen"
            actionHref="/datenblatt-vorlagen/neu"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(templates ?? []).map((t: any) => (
              <div key={t.id} className="glass-card card-hover group flex flex-col">
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      {t.is_system ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--violet))]" />
                      )}
                      <h3 className="flex-1 truncate text-[14.5px] font-semibold tracking-[-0.01em] transition-colors group-hover:text-primary">
                        {t.name}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                      {t.is_system ? (
                        <span className="pill pill-accent">System</span>
                      ) : (
                        <span
                          className="pill"
                          style={{
                            background: "hsl(var(--violet) / 0.14)",
                            color: "hsl(var(--violet))",
                          }}
                        >
                          Custom
                        </span>
                      )}
                      {/* PROJ-38: Layout-Status */}
                      {t.latex_template_key ? (
                        <span
                          className="pill"
                          style={{ background: "hsl(142 71% 45% / 0.14)", color: "hsl(142 71% 35%)" }}
                          title={`LaTeX-Layout: ${t.latex_template_key}`}
                        >
                          Aktiviert
                        </span>
                      ) : (
                        <span
                          className="pill"
                          style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                          title="Keine LaTeX-Layout-Verknüpfung — wird im PDF-Export nicht verwendet"
                        >
                          Skeleton
                        </span>
                      )}
                      {t.is_default && (
                        <span
                          className="pill pill-accent"
                          title="Default-Vorlage — wird verwendet, wenn ein Produkt keine eigene Vorlage hat"
                        >
                          Default
                        </span>
                      )}
                      <span className="text-muted-foreground">{(t.slots as Slot[]).length} Slots</span>
                      <span className="text-muted-foreground">
                        · {t.page_width_cm}×{t.page_height_cm} cm
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/datenblatt-vorlagen/${t.id}`}
                    className="mx-auto block transition-transform hover:scale-[1.02]"
                  >
                    {t.preview_image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.preview_image_path}
                        alt={`Vorschau ${t.name}`}
                        width={260}
                        className="rounded border border-border/60 shadow-sm"
                        style={{
                          aspectRatio: `${t.page_width_cm} / ${t.page_height_cm}`,
                          objectFit: "cover",
                          background: "white",
                        }}
                      />
                    ) : (
                      <TemplatePreview
                        pageWidth={Number(t.page_width_cm)}
                        pageHeight={Number(t.page_height_cm)}
                        slots={t.slots as Slot[]}
                        targetWidthPx={260}
                      />
                    )}
                  </Link>

                  <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2">
                    <div className="flex gap-0.5">
                      <DuplicateButton id={t.id} />
                      {!t.is_system && <DeleteTemplateButton id={t.id} name={t.name} />}
                    </div>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/datenblatt-vorlagen/${t.id}`}>
                        {t.is_system ? (
                          "Ansehen"
                        ) : (
                          <>
                            <Pencil className="h-3.5 w-3.5" />
                            Bearbeiten
                          </>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
