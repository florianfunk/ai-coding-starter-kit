import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { KategorieForm } from "../../kategorie-form";
import { updateKategorie, type KategorieFormState } from "../../actions";

export default async function EditKategoriePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: kat } = await supabase.from("kategorien").select("*").eq("id", id).single();
  if (!kat) notFound();

  const [{ data: bereiche }, { data: icons }, { data: katIcons }] = await Promise.all([
    supabase.from("bereiche").select("id,name").order("sortierung"),
    supabase.from("icons").select("id,label").order("label"),
    supabase.from("kategorie_icons").select("icon_id").eq("kategorie_id", id),
  ]);

  const bildUrl = await getSignedUrl("produktbilder", kat.vorschaubild_path);
  const iconIds = (katIcons ?? []).map((r) => r.icon_id);

  async function action(prev: KategorieFormState, formData: FormData) {
    "use server";
    return updateKategorie(id, prev, formData);
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Kategorie bearbeiten: {kat.name}</h1>
        <KategorieForm
          bereiche={bereiche ?? []}
          icons={icons ?? []}
          defaultValues={{
            bereich_id: kat.bereich_id,
            name: kat.name,
            beschreibung: kat.beschreibung,
            sortierung: kat.sortierung,
            vorschaubild_path: kat.vorschaubild_path,
            vorschaubild_url: bildUrl,
            iconIds,
          }}
          action={action}
          submitLabel="Speichern"
        />
      </div>
    </AppShell>
  );
}
