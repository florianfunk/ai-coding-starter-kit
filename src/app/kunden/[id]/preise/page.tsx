import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KundenPreiseSection } from "./kunden-preise-section";

export default async function PreiseTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: kunde } = await supabase
    .from("kunden")
    .select("preis_spur, aufschlag_vorzeichen, aufschlag_pct, alle_produkte")
    .eq("id", id)
    .maybeSingle();
  if (!kunde) notFound();

  // Top-10 Produkte aus Whitelist (oder Default-10 bei alle_produkte)
  const { data: whitelist } = await supabase
    .from("kunde_produkt")
    .select("produkt_id")
    .eq("kunde_id", id)
    .limit(10);
  const ids = (whitelist ?? []).map((w) => w.produkt_id as string);

  let produkte: Array<{ id: string; artikelnummer: string; name: string }> = [];
  let preise: Array<{
    produkt_id: string;
    listenpreis: number | null;
    ek_lichtengros: number | null;
    ek_eisenkeil: number | null;
  }> = [];

  if (kunde.alle_produkte) {
    const { data } = await supabase
      .from("produkte")
      .select("id, artikelnummer, name")
      .order("sortierung")
      .limit(10);
    produkte = (data ?? []) as typeof produkte;
  } else if (ids.length > 0) {
    const { data } = await supabase
      .from("produkte")
      .select("id, artikelnummer, name")
      .in("id", ids)
      .order("sortierung")
      .limit(10);
    produkte = (data ?? []) as typeof produkte;
  }

  if (produkte.length > 0) {
    const { data } = await supabase
      .from("aktuelle_preise_flat")
      .select("produkt_id, listenpreis, ek_lichtengros, ek_eisenkeil")
      .in(
        "produkt_id",
        produkte.map((p) => p.id),
      );
    preise = (data ?? []) as typeof preise;
  }

  return (
    <KundenPreiseSection
      kundeId={id}
      initial={{
        preis_spur: kunde.preis_spur as "lichtengros" | "eisenkeil" | "listenpreis",
        aufschlag_vorzeichen: kunde.aufschlag_vorzeichen as "plus" | "minus",
        aufschlag_pct: Number(kunde.aufschlag_pct),
      }}
      vorschau={produkte.map((p) => {
        const pr = preise.find((pp) => pp.produkt_id === p.id);
        return {
          id: p.id,
          artikelnummer: p.artikelnummer,
          name: p.name,
          lichtengros: pr?.ek_lichtengros != null ? Number(pr.ek_lichtengros) : null,
          eisenkeil: pr?.ek_eisenkeil != null ? Number(pr.ek_eisenkeil) : null,
          listenpreis: pr?.listenpreis != null ? Number(pr.listenpreis) : null,
        };
      })}
    />
  );
}
