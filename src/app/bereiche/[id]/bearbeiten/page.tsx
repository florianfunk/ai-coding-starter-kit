import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { bildProxyUrl } from "@/lib/bild-url";
import { BereichForm } from "../../bereich-form";
import { updateBereich, type BereichFormState } from "../../actions";

export default async function EditBereichPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: bereich } = await supabase.from("bereiche").select("*").eq("id", id).single();
  if (!bereich) notFound();

  const bildUrl = bildProxyUrl("produktbilder", bereich.bild_path);

  async function action(prev: BereichFormState, formData: FormData) {
    "use server";
    return updateBereich(id, prev, formData);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Bearbeiten"
        title={`Bereich: ${bereich.name}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Bereiche", href: "/bereiche" },
          { label: bereich.name, href: `/bereiche/${id}` },
          { label: "Bearbeiten" },
        ]}
      />
      <BereichForm
        bereichId={id}
        defaultValues={{
          name: bereich.name,
          beschreibung: bereich.beschreibung,
          sortierung: bereich.sortierung,
          seitenzahl: bereich.seitenzahl,
          startseite: bereich.startseite,
          endseite: bereich.endseite,
          farbe: bereich.farbe,
          bild_path: bereich.bild_path,
          bild_url: bildUrl,
        }}
        action={action}
        submitLabel="Speichern"
      />
    </AppShell>
  );
}
