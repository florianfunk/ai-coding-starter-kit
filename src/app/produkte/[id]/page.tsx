import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { bildProxyUrl } from "@/lib/bild-url";
import { Button } from "@/components/ui/button";
import { ProduktForm } from "../produkt-form";
import { updateProdukt, type ProduktFormState } from "../actions";
import { ProduktTopActions } from "./top-actions";
import { ProduktNav } from "./produkt-nav";
import { PreiseSection } from "./preise-section";
import { DatenblattSection } from "./datenblatt-section";
import { ChevronLeft, ChevronRight, FileText, Sparkles } from "lucide-react";
import type { DatenblattTemplate } from "@/lib/datenblatt";
import { calculateCompleteness } from "@/lib/completeness";
import { AuditSection } from "./audit-section";
import { ProduktTabs } from "./produkt-tabs";
import { ProduktRail, buildSectionStats, buildChecks } from "./produkt-rail";
import { getBereiche, getKategorien, getIcons, getDatenblattTemplates } from "@/lib/cache";

export default async function ProduktDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Slowly-changing Lookups (Bereiche, Kategorien, Icons, Templates) aus dem
  // unstable_cache holen — kein DB-Roundtrip, wenn der Cache warm ist.
  const [bereiche, kategorien, iconsCached, templatesCached] = await Promise.all([
    getBereiche(),
    getKategorien(),
    getIcons(),
    getDatenblattTemplates(),
  ]);

  // Produkt + produkt-spezifische Daten parallel — alle anderen Lookups
  // kamen aus dem Cache.
  const [
    { data: produkt },
    { data: produktIcons },
    { data: preise },
  ] = await Promise.all([
    supabase.from("produkte").select("*").eq("id", id).single(),
    supabase.from("produkt_icons").select("icon_id, wert").eq("produkt_id", id).order("sortierung"),
    supabase
      .from("preise")
      .select("id, produkt_id, spur, gueltig_ab, preis, quelle, created_at")
      .eq("produkt_id", id)
      .order("spur")
      .order("gueltig_ab", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!produkt) notFound();

  // Geschwister-Produkte derselben Kategorie für Vor/Zurück-Navigation
  // (gleiche Sortierreihenfolge wie /kategorien/[id]).
  const { data: siblings } = await supabase
    .from("produkte")
    .select("id, artikelnummer")
    .eq("kategorie_id", produkt.kategorie_id)
    .order("sortierung")
    .order("artikelnummer");
  const siblingList = siblings ?? [];
  const currentIdx = siblingList.findIndex((p) => p.id === id);
  const prevSibling = currentIdx > 0 ? siblingList[currentIdx - 1] : null;
  const nextSibling = currentIdx >= 0 && currentIdx < siblingList.length - 1 ? siblingList[currentIdx + 1] : null;

  // Slot-Rows nur abfragen, wenn ein Template gewählt ist (sonst leeres Array).
  const { data: slotRows } = produkt.datenblatt_template_id
    ? await supabase
        .from("produkt_datenblatt_slots")
        .select("slot_id,storage_path")
        .eq("produkt_id", id)
        .eq("template_id", produkt.datenblatt_template_id)
    : { data: [] as Array<{ slot_id: string; storage_path: string | null }> };

  // Bereich + Kategorie aus dem Cache lookup'en — keine extra DB-Queries.
  const bereichRow = bereiche.find((b) => b.id === produkt.bereich_id) ?? null;
  const kategorieRow = kategorien.find((k) => k.id === produkt.kategorie_id) ?? null;

  const hauptbildUrl = bildProxyUrl("produktbilder", produkt.hauptbild_path);

  // PROJ-36: URLs für Datenblatt-Bilder (Detail, Zeichnung, Energielabel)
  const defaultDatenblattBildUrls = {
    bild_detail_1_path: bildProxyUrl("produktbilder", produkt.bild_detail_1_path),
    bild_detail_2_path: bildProxyUrl("produktbilder", produkt.bild_detail_2_path),
    bild_zeichnung_1_path: bildProxyUrl("produktbilder", produkt.bild_zeichnung_1_path),
    bild_zeichnung_2_path: bildProxyUrl("produktbilder", produkt.bild_zeichnung_2_path),
    bild_zeichnung_3_path: bildProxyUrl("produktbilder", produkt.bild_zeichnung_3_path),
    bild_energielabel_path: bildProxyUrl("produktbilder", produkt.bild_energielabel_path),
  };

  const iconsFull = iconsCached.map((ic) => ({
    id: ic.id,
    label: ic.label,
    gruppe: ic.gruppe,
    url: bildProxyUrl("produktbilder", ic.symbol_path),
  }));

  // PROJ-38: Nur Vorlagen mit aktiviertem LaTeX-Layout in der Auswahl anzeigen.
  // Skeletons (latex_template_key IS NULL) sind unsichtbar fuer den Pfleger.
  const templatesTyped: DatenblattTemplate[] = templatesCached
    .filter((t: any) => Boolean(t.latex_template_key))
    .map((t: any) => ({
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

  const todayIso = new Date().toISOString().slice(0, 10);
  const hasActivePrice = (preise ?? []).some((p) => p.gueltig_ab <= todayIso);
  const iconCount = (produktIcons ?? []).length;
  const hasTemplate = Boolean(produkt.datenblatt_template_id);
  const completeness = calculateCompleteness(produkt, { hasActivePrice, iconCount });

  const sectionStats = buildSectionStats(produkt, { hasActivePrice, iconCount, hasTemplate });
  const checks = buildChecks(completeness, sectionStats, { hasTemplate });

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

              <div className="flex flex-wrap items-center gap-2">
                <ProduktNav
                  prevId={prevSibling?.id ?? null}
                  nextId={nextSibling?.id ?? null}
                  position={currentIdx >= 0 ? currentIdx + 1 : 0}
                  total={siblingList.length}
                  prevLabel={prevSibling?.artikelnummer ?? null}
                  nextLabel={nextSibling?.artikelnummer ?? null}
                />
                <Button asChild variant="outline" size="sm">
                  <Link href={`/produkte/${id}/datenblatt`} target="_blank" rel="noopener noreferrer">
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
              defaultIconWerte={Object.fromEntries(
                (produktIcons ?? [])
                  .filter((r) => r.wert !== null && r.wert !== undefined && r.wert !== "")
                  .map((r) => [r.icon_id, r.wert as string]),
              )}
              defaultHauptbildUrl={hauptbildUrl}
              defaultDatenblattBildUrls={defaultDatenblattBildUrls}
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
            <AuditSection produktId={id} />

            <div className="mt-2 flex justify-center pt-2">
              <Link
                href="/produkte"
                className="text-[13px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                ← Zurück zur Produktliste
              </Link>
            </div>
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
