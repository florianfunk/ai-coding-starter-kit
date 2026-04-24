import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { KategorieForm, type IconOption } from "../../kategorie-form";
import { updateKategorie, type KategorieFormState } from "../../actions";

export default async function EditKategoriePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: kat } = await supabase.from("kategorien").select("*").eq("id", id).single();
  if (!kat) notFound();

  const [{ data: bereiche }, { data: icons }, { data: katIcons }] = await Promise.all([
    supabase.from("bereiche").select("id,name").order("sortierung"),
    supabase.from("icons").select("id,label,gruppe,symbol_path").order("gruppe").order("sortierung").order("label"),
    supabase.from("kategorie_icons").select("icon_id").eq("kategorie_id", id).order("sortierung"),
  ]);

  const iconOptions: IconOption[] = await Promise.all(
    (icons ?? []).map(async (ic: any) => ({
      id: ic.id, label: ic.label, gruppe: ic.gruppe,
      url: await getSignedUrl("produktbilder", ic.symbol_path),
    })),
  );

  const [bild1Url, bild2Url, bild3Url, bild4Url] = await Promise.all([
    getSignedUrl("produktbilder", kat.bild1_path),
    getSignedUrl("produktbilder", kat.bild2_path),
    getSignedUrl("produktbilder", kat.bild3_path),
    getSignedUrl("produktbilder", kat.bild4_path),
  ]);
  const iconIds = (katIcons ?? []).map((r) => r.icon_id);

  async function action(prev: KategorieFormState, formData: FormData) {
    "use server";
    return updateKategorie(id, prev, formData);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Bearbeiten"
        title={`Kategorie: ${kat.name}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Kategorien", href: "/kategorien" },
          { label: kat.name, href: `/kategorien/${id}` },
          { label: "Bearbeiten" },
        ]}
      />
      <KategorieForm
        bereiche={bereiche ?? []}
        icons={iconOptions}
        kategorieId={id}
        defaultValues={{
          bereich_id: kat.bereich_id,
          name: kat.name,
          beschreibung: kat.beschreibung,
          sortierung: kat.sortierung,
          bild1_path: kat.bild1_path,
          bild2_path: kat.bild2_path,
          bild3_path: kat.bild3_path,
          bild4_path: kat.bild4_path,
          bild1_url: bild1Url,
          bild2_url: bild2Url,
          bild3_url: bild3Url,
          bild4_url: bild4Url,
          iconIds,
          spalten: [
            kat.spalte_1, kat.spalte_2, kat.spalte_3, kat.spalte_4, kat.spalte_5,
            kat.spalte_6, kat.spalte_7, kat.spalte_8, kat.spalte_9,
          ],
        }}
        action={action}
        submitLabel="Speichern"
      />
    </AppShell>
  );
}
