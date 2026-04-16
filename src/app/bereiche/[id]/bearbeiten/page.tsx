import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { BereichForm } from "../../bereich-form";
import { updateBereich, type BereichFormState } from "../../actions";

export default async function EditBereichPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: bereich } = await supabase.from("bereiche").select("*").eq("id", id).single();
  if (!bereich) notFound();

  const bildUrl = await getSignedUrl("produktbilder", bereich.bild_path);

  async function action(prev: BereichFormState, formData: FormData) {
    "use server";
    return updateBereich(id, prev, formData);
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Bereich bearbeiten: {bereich.name}</h1>
        <BereichForm
          defaultValues={{
            name: bereich.name,
            beschreibung: bereich.beschreibung,
            sortierung: bereich.sortierung,
            seitenzahl: bereich.seitenzahl,
            startseite: bereich.startseite,
            bild_path: bereich.bild_path,
            bild_url: bildUrl,
          }}
          action={action}
          submitLabel="Speichern"
        />
      </div>
    </AppShell>
  );
}
