import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KundenStammdatenForm } from "../../kunden-stammdaten-form";

export default async function StammdatenTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: kunde }, { data: branchen }, { data: kbRows }] = await Promise.all([
    supabase.from("kunden").select("*").eq("id", id).maybeSingle(),
    supabase.from("kunden_branchen").select("id, name").order("name"),
    supabase.from("kunde_branche").select("branche_id").eq("kunde_id", id),
  ]);

  if (!kunde) notFound();

  const brancheIds = (kbRows ?? []).map((r) => r.branche_id as string);

  return (
    <div className="max-w-3xl">
      <KundenStammdatenForm
        mode="edit"
        alleBranchen={branchen ?? []}
        initial={{
          id: kunde.id,
          kunden_nr: kunde.kunden_nr,
          firma: kunde.firma,
          ansprechpartner: kunde.ansprechpartner ?? "",
          email: kunde.email ?? "",
          telefon: kunde.telefon ?? "",
          website: kunde.website ?? "",
          strasse: kunde.strasse ?? "",
          plz: kunde.plz ?? "",
          ort: kunde.ort ?? "",
          land: kunde.land ?? "",
          standard_filiale:
            (kunde.standard_filiale as "lichtengros" | "eisenkeil" | null) ?? "",
          notizen: kunde.notizen ?? "",
          status: kunde.status as "aktiv" | "archiviert",
          branche_ids: brancheIds,
        }}
      />
    </div>
  );
}
