import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
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
    supabase.from("kategorie_icons").select("icon_id").eq("kategorie_id", id),
  ]);

  const iconOptions: IconOption[] = await Promise.all(
    (icons ?? []).map(async (ic: any) => ({
      id: ic.id, label: ic.label, gruppe: ic.gruppe,
      url: await getSignedUrl("produktbilder", ic.symbol_path),
    })),
  );

  const bildUrl = await getSignedUrl("produktbilder", kat.vorschaubild_path);
  const iconIds = (katIcons ?? []).map((r) => r.icon_id);

  async function action(prev: KategorieFormState, formData: FormData) {
    "use server";
    return updateKategorie(id, prev, formData);
  }

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground hover:text-primary hover:bg-primary/5">
        <Link href={`/kategorien/${id}`}><ChevronLeft className="h-4 w-4 mr-1" /> Zurück zur Kategorie</Link>
      </Button>
      <PageHeader eyebrow="Bearbeiten" title={`Kategorie: ${kat.name}`} />
      <KategorieForm
        bereiche={bereiche ?? []}
        icons={iconOptions}
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
    </AppShell>
  );
}
