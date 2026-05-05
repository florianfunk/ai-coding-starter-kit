import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getKatalogTree } from "@/lib/cache";
import { KundenAuswahlSection } from "./kunden-auswahl-section";

export default async function AuswahlTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: kunde }, { data: whitelist }, treeRaw] = await Promise.all([
    supabase
      .from("kunden")
      .select("alle_produkte")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("kunde_produkt").select("produkt_id").eq("kunde_id", id),
    getKatalogTree(),
  ]);

  if (!kunde) notFound();

  const tree = treeRaw.map((b) => ({
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

  return (
    <KundenAuswahlSection
      kundeId={id}
      tree={tree}
      initialAlleProdukte={!!kunde.alle_produkte}
      initialWhitelist={(whitelist ?? []).map((w) => w.produkt_id as string)}
    />
  );
}
