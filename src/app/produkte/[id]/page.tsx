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
import { ChevronLeft, ChevronRight, FileText, Sparkles } from "lucide-react";
import type { DatenblattTemplate } from "@/lib/datenblatt";
import { calculateCompleteness } from "@/lib/completeness";
import { AuditSection } from "./audit-section";
import { ProduktTabs } from "./produkt-tabs";
import { ProduktRail, buildSectionStats, buildChecks } from "./produkt-rail";

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
    supabase.from("bereiche").select("id,name,farbe").eq("id", produkt.bereich_id).single(),
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

  const slotImages: Record<string, { path: string; url: string }> = {};
  for (const row of slotRows ?? []) {
    if (!row.storage_path) continue;
    const url = bildProxyUrl("produktbilder", row.storage_path);
    if (url) slotImages[row.slot_id] = { path: row.storage_path, url };
  }

  const hasActivePrice = (preise ?? []).some((p) => p.status === "aktiv");
  const iconCount = (produktIcons ?? []).length;
  const galerieCount = (galerie ?? []).length;
  const hasTemplate = Boolean(produkt.datenblatt_template_id);
  const completeness = calculateCompleteness(produkt, { hasActivePrice, iconCount, galerieCount });

  const sectionStats = buildSectionStats(produkt, { hasActivePrice, iconCount, galerieCount, hasTemplate });
  const checks = buildChecks(completeness, sectionStats, { galerieCount, hasTemplate });

  const completenessColor =
    completeness.color === "green"
      ? "hsl(var(--green))"
      : completeness.color === "yellow"
        ? "hsl(var(--warning))"
        : "hsl(var(--destructive))";

  const ringR = 19;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - completeness.percent / 100);
  const blocksDone = sectionStats.filter((s) => s.total > 0 && s.done === s.total).length;

  const tabs = [
    { id: "base", label: "Details", badge: null },
    { id: "images", label: "Bilder & Galerie", badge: galerieCount },
    { id: "prices", label: "Preise", badge: (preise ?? []).length },
    { id: "datasheet", label: "Datenblatt-Vorlage", badge: null },
    { id: "history", label: "Historie", badge: null },
  ];

  async function action(prev: ProduktFormState, formData: FormData) {
    "use server";
    return updateProdukt(id, prev, formData);
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        {/* Breadcrumb */}
        <div className="crumbs">
          <Link href="/">Dashboard</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/produkte">Produkte</Link>
          {bereichRow && (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link href={`/bereiche/${bereichRow.id}`}>{bereichRow.name}</Link>
            </>
          )}
          {kategorieRow && (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link href={`/kategorien/${kategorieRow.id}`}>{kategorieRow.name}</Link>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="font-mono text-foreground">{produkt.artikelnummer}</span>
        </div>

        {/* Header card with tabs */}
        <div className="glass-card px-6 py-[22px]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-[260px] flex-1 basis-[320px] break-all">
              <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                <span className="eyebrow text-primary">
                  Produkt{bereichRow ? ` · ${bereichRow.name}` : ""}
                </span>
                {produkt.artikel_bearbeitet ? (
                  <span className="pill pill-ok">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                    Live
                  </span>
                ) : (
                  <span className="pill pill-warn">Entwurf</span>
                )}
              </div>
              <h1 className="display-lg font-mono text-[34px] tracking-[-0.02em]">
                {produkt.artikelnummer}
              </h1>
              <p className="mt-1.5 text-[14px] text-muted-foreground">
                {produkt.name ?? produkt.datenblatt_titel ?? "—"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2.5">
                <div className="relative h-12 w-12 shrink-0">
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
                <div>
                  <div className="eyebrow !text-[10px]">Vollständigkeit</div>
                  <div className="mt-0.5 text-[13px] font-semibold">
                    {completeness.percent}% · {blocksDone}/{sectionStats.length} Blöcke fertig
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/produkte/${id}/datenblatt`}>
                    <FileText className="h-3.5 w-3.5" /> Datenblatt
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={kategorieRow ? `/kategorien/${kategorieRow.id}` : "/produkte"}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Zurück
                  </Link>
                </Button>
                <ProduktTopActions id={id} artikelnummer={produkt.artikelnummer} />
              </div>
            </div>
          </div>

          {/* Tab strip */}
          <div className="mt-5">
            <ProduktTabs tabs={tabs} />
          </div>
        </div>

        {/* Two-column layout: main + right rail */}
        <div className="produkt-grid grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-3.5">
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

          <ProduktRail
            produktId={id}
            sections={sectionStats}
            checks={checks}
            createdAt={produkt.created_at}
            updatedAt={produkt.updated_at}
            produkt={produkt}
          />
        </div>

        {/* AI assist banner at the bottom — no backend yet, placeholder hidden on mobile */}
        <div
          className="mt-2 hidden lg:block lg:self-end lg:text-right"
          aria-hidden
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--violet))/10] px-3 py-1 text-[11.5px] font-medium text-[hsl(var(--violet))]">
            <Sparkles className="h-3 w-3" />
            KI-Assistent steht bereit
          </div>
        </div>
      </div>
    </AppShell>
  );
}
