import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { KundenTabsNav } from "../kunden-tabs-nav";
import { KundenQuickButtons } from "../kunden-quick-buttons";
import { getKatalogTree } from "@/lib/cache";
import type { KatalogTreeBereich } from "@/lib/cache";

type Props = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function KundenDetailLayout({ children, params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: kunde }, { data: einstellungen }, treeRaw, { data: whitelist }] =
    await Promise.all([
      supabase
        .from("kunden")
        .select(
          "id, kunden_nr, firma, status, standard_filiale, preis_spur, aufschlag_vorzeichen, aufschlag_pct, alle_produkte",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("katalog_einstellungen")
        .select("wechselkurs_eur_chf")
        .eq("id", 1)
        .single(),
      getKatalogTree(),
      supabase.from("kunde_produkt").select("produkt_id").eq("kunde_id", id),
    ]);

  if (!kunde) notFound();

  const wechselkurs = Number(einstellungen?.wechselkurs_eur_chf ?? 1);
  const tree = mapTreeForWizard(treeRaw);

  const whitelistIds = (whitelist ?? []).map((w) => w.produkt_id as string);
  const wizardKundeContext = {
    id: kunde.id,
    kunden_nr: kunde.kunden_nr,
    firma: kunde.firma,
    defaults: {
      layout:
        (kunde.standard_filiale as "lichtengros" | "eisenkeil" | null) ?? "lichtengros",
      preisauswahl: kunde.preis_spur as "lichtengros" | "eisenkeil" | "listenpreis",
      preisAenderung: kunde.aufschlag_vorzeichen as "plus" | "minus",
      preisProzent: Number(kunde.aufschlag_pct),
      waehrung: "EUR" as const,
      sprache: "de" as const,
    },
    whitelistProduktIds: kunde.alle_produkte ? null : whitelistIds,
  };

  return (
    <AppShell>
      <PageHeader
        title={kunde.firma}
        subtitle={`Kunden-Nr. ${kunde.kunden_nr}`}
        breadcrumbs={[
          { label: "Kunden", href: "/kunden" },
          { label: kunde.firma },
        ]}
      >
        <Badge variant={kunde.status === "aktiv" ? "default" : "outline"}>
          {kunde.status}
        </Badge>
        <KundenQuickButtons
          kundeContext={wizardKundeContext}
          tree={tree}
          wechselkurs={wechselkurs}
        />
      </PageHeader>

      <KundenTabsNav kundeId={id} />

      <div className="mt-6">{children}</div>
    </AppShell>
  );
}

function mapTreeForWizard(raw: KatalogTreeBereich[]) {
  return raw.map((b) => ({
    id: b.id,
    name: b.name,
    kategorien: b.kategorien.map((k) => ({
      id: k.id,
      name: k.name,
      produkte: k.produkte.map((p) => ({
        id: p.id,
        artikelnummer: p.artikelnummer,
        name: p.name,
      })),
    })),
  }));
}
