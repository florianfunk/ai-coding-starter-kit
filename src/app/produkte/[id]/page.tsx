import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { bildProxyUrl } from "@/lib/bild-url";
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
    supabase.from("produkt_icons").select("icon_id").eq("produkt_id", id).order("sortierung"),
    supabase.from("produkt_bilder").select("*").eq("produkt_id", id).order("sortierung"),
    supabase.from("preise").select("*").eq("produkt_id", id).order("gueltig_ab", { ascending: false }),
    supabase.from("datenblatt_templates").select("*").order("is_system", { ascending: false }).order("sortierung"),
    produkt.datenblatt_template_id
      ? supabase.from("produkt_datenblatt_slots").select("slot_id,storage_path").eq("produkt_id", id).eq("template_id", produkt.datenblatt_template_id)
      : Promise.resolve({ data: [] }),
    supabase.from("bereiche").select("id,name").eq("id", produkt.bereich_id).single(),
    supabase.from("kategorien").select("id,name").eq("id", produkt.kategorie_id).single(),
  ]);

  const hauptbildUrl = bildProxyUrl("produktbilder", produkt.hauptbild_path);
  const galerieMit = (galerie ?? []).map((g) => ({
    ...g,
    url: bildProxyUrl("produktbilder", g.storage_path),
  }));

  const iconsFull = (icons ?? []).map((ic: any) => ({
    id: ic.id,
    label: ic.label,
    gruppe: ic.gruppe,
    url: bildProxyUrl("produktbilder", ic.symbol_path),
  }));

  const templatesTyped: DatenblattTemplate[] = (templates ?? []).map((t: any) => ({
    ...t,
    page_width_cm: Number(t.page_width_cm),
    page_height_cm: Number(t.page_height_cm),
    slots: t.slots ?? [],
  }));

  // Build slot-image map (via Proxy-URL) for the active template
  const slotImages: Record<string, { path: string; url: string }> = {};
  for (const row of slotRows ?? []) {
    if (!row.storage_path) continue;
    const url = bildProxyUrl("produktbilder", row.storage_path);
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

  const completenessColor =
    completeness.color === "green"
      ? "hsl(var(--green))"
      : completeness.color === "yellow"
        ? "hsl(var(--warning))"
        : "hsl(var(--destructive))";

  const ringR = 19;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - completeness.percent / 100);

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList className="text-[12.5px] text-muted-foreground">
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

        <div className="glass-card px-6 py-[22px]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-[260px] flex-1 basis-[320px]">
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="eyebrow text-primary">Produkt{bereichRow ? ` · ${bereichRow.name}` : ""}</span>
              </div>
              <h1 className="display-lg break-all font-mono text-[34px] tracking-[-0.02em]">
                {produkt.artikelnummer}
              </h1>
              <p className="mt-1.5 text-[14px] text-muted-foreground">{produkt.name ?? "—"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="relative h-12 w-12">
                  <svg width={48} height={48} viewBox="0 0 48 48" className="-rotate-90">
                    <circle cx={24} cy={24} r={ringR} stroke="hsl(var(--hairline))" strokeWidth={5} fill="none" />
                    <circle
                      cx={24}
                      cy={24}
                      r={ringR}
                      stroke={completenessColor}
                      strokeWidth={5}
                      fill="none"
                      strokeDasharray={ringC}
                      strokeDashoffset={ringOffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 grid place-items-center text-[12px] font-bold tracking-[-0.015em]">
                    {completeness.percent}
                  </div>
                </div>
                <CompletenessDetail result={completeness} className="text-[12.5px]" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/produkte/${id}/datenblatt`}>
                    <FileText className="mr-1 h-3.5 w-3.5" /> Datenblatt
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={kategorieRow ? `/kategorien/${kategorieRow.id}` : "/produkte"}>
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Zurück
                  </Link>
                </Button>
                <ProduktTopActions id={id} artikelnummer={produkt.artikelnummer} />
              </div>
            </div>
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

          <div className="mt-8 pt-8 border-t border-dashed border-muted-foreground/20 space-y-8">
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
