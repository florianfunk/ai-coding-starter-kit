import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { ProduktForm } from "../produkt-form";
import { updateProdukt, type ProduktFormState } from "../actions";
import { ProduktTopActions } from "./top-actions";
import { PreiseSection } from "./preise-section";
import { GalerieSection } from "./galerie-section";
import { DatenblattSection } from "./datenblatt-section";
import { ChevronLeft, FileText } from "lucide-react";
import { SplitViewLayout } from "./split-view-layout";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { DatenblattTemplate } from "@/lib/datenblatt";
import { calculateCompleteness } from "@/lib/completeness";
import { CompletenessDetail } from "@/components/completeness-detail";
import { AuditSection } from "./audit-section";

export default async function ProduktDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: produkt } = await supabase.from("produkte").select("*").eq("id", id).single();
  if (!produkt) notFound();

  const [
    { data: bereiche }, { data: kategorien }, { data: icons },
    { data: produktIcons }, { data: galerie }, { data: preise },
    { data: templates }, { data: slotRows },
    { data: bereichRow }, { data: kategorieRow },
  ] = await Promise.all([
    supabase.from("bereiche").select("id,name").order("sortierung"),
    supabase.from("kategorien").select("id,name,bereich_id").order("name"),
    supabase.from("icons").select("id,label,gruppe,symbol_path").order("gruppe").order("sortierung").order("label"),
    supabase.from("produkt_icons").select("icon_id").eq("produkt_id", id),
    supabase.from("produkt_bilder").select("*").eq("produkt_id", id).order("sortierung"),
    supabase.from("preise").select("*").eq("produkt_id", id).order("gueltig_ab", { ascending: false }),
    supabase.from("datenblatt_templates").select("*").order("is_system", { ascending: false }).order("sortierung"),
    produkt.datenblatt_template_id
      ? supabase.from("produkt_datenblatt_slots").select("slot_id,storage_path").eq("produkt_id", id).eq("template_id", produkt.datenblatt_template_id)
      : Promise.resolve({ data: [] }),
    supabase.from("bereiche").select("id,name").eq("id", produkt.bereich_id).single(),
    supabase.from("kategorien").select("id,name").eq("id", produkt.kategorie_id).single(),
  ]);

  const hauptbildUrl = await getSignedUrl("produktbilder", produkt.hauptbild_path);
  const galerieMit = await Promise.all(
    (galerie ?? []).map(async (g) => ({ ...g, url: await getSignedUrl("produktbilder", g.storage_path) })),
  );

  const iconsFull = await Promise.all(
    (icons ?? []).map(async (ic: any) => ({
      id: ic.id, label: ic.label, gruppe: ic.gruppe,
      url: await getSignedUrl("produktbilder", ic.symbol_path),
    })),
  );

  const templatesTyped: DatenblattTemplate[] = (templates ?? []).map((t: any) => ({
    ...t,
    page_width_cm: Number(t.page_width_cm),
    page_height_cm: Number(t.page_height_cm),
    slots: t.slots ?? [],
  }));

  // Build slot-image map (with signed URLs) for the active template
  const slotImages: Record<string, { path: string; url: string }> = {};
  for (const row of slotRows ?? []) {
    if (!row.storage_path) continue;
    const url = await getSignedUrl("produktbilder", row.storage_path);
    if (url) slotImages[row.slot_id] = { path: row.storage_path, url };
  }

  // Compute completeness
  const hasActivePrice = (preise ?? []).some((p) => p.status === "aktiv");
  const completeness = calculateCompleteness(produkt, {
    hasActivePrice,
    iconCount: (produktIcons ?? []).length,
    galerieCount: (galerie ?? []).length,
  });

  async function action(prev: ProduktFormState, formData: FormData) {
    "use server";
    return updateProdukt(id, prev, formData);
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/">Dashboard</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/produkte">Produkte</Link></BreadcrumbLink>
            </BreadcrumbItem>
            {bereichRow && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild><Link href={`/bereiche/${bereichRow.id}`}>{bereichRow.name}</Link></BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            {kategorieRow && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild><Link href={`/kategorien/${kategorieRow.id}`}>{kategorieRow.name}</Link></BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-mono">{produkt.artikelnummer}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-start justify-between gap-4 pb-4 border-b">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-1">Produkt</p>
            <h1 className="text-3xl font-bold tracking-tight font-mono break-all">{produkt.artikelnummer}</h1>
            <p className="text-muted-foreground mt-1">{produkt.name ?? "—"}</p>
          </div>
          <div className="flex gap-2 shrink-0 items-center flex-wrap justify-end">
            <CompletenessDetail result={completeness} />
            <Button asChild variant="outline" className="hover:bg-muted/50">
              <Link href={`/produkte/${id}/datenblatt`}>
                <FileText className="h-4 w-4 mr-1" /> Datenblatt
              </Link>
            </Button>
            <Button asChild variant="outline" className="hover:bg-muted/50">
              <Link href={kategorieRow ? `/kategorien/${kategorieRow.id}` : "/produkte"}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
              </Link>
            </Button>
            <ProduktTopActions id={id} artikelnummer={produkt.artikelnummer} />
          </div>
        </div>

        <SplitViewLayout produktId={id}>
          <ProduktForm
            bereiche={bereiche ?? []}
            kategorien={kategorien ?? []}
            icons={iconsFull}
            defaultValues={produkt}
            defaultIconIds={(produktIcons ?? []).map((r) => r.icon_id)}
            defaultHauptbildUrl={hauptbildUrl}
            produktId={id}
            action={action}
            submitLabel="Speichern"
          />

          <div className="mt-8 pt-8 border-t-2 border-dashed border-muted-foreground/20 space-y-8">
            <DatenblattSection
              produktId={id}
              templates={templatesTyped}
              activeTemplateId={produkt.datenblatt_template_id}
              slotImages={slotImages}
            />

            <PreiseSection produktId={id} preise={preise ?? []} />
            <GalerieSection produktId={id} bilder={galerieMit} hauptbildPath={produkt.hauptbild_path} />
            <AuditSection produktId={id} />
          </div>
        </SplitViewLayout>
      </div>
    </AppShell>
  );
}
