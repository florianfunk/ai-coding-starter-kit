import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
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
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground hover:text-primary hover:bg-primary/5">
        <Link href={`/bereiche/${id}`}><ChevronLeft className="h-4 w-4 mr-1" /> Zurück zum Bereich</Link>
      </Button>
      <PageHeader eyebrow="Bearbeiten" title={`Bereich: ${bereich.name}`} />
      <BereichForm
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
