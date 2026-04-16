import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { IconForm } from "../icon-form";
import { updateIcon, type IconFormState } from "../actions";

export default async function EditIconPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: icon } = await supabase.from("icons").select("*").eq("id", id).single();
  if (!icon) notFound();

  const { data: allGruppen } = await supabase
    .from("icons")
    .select("gruppe")
    .not("gruppe", "is", null);
  const gruppen = Array.from(new Set((allGruppen ?? []).map((r) => r.gruppe).filter(Boolean))) as string[];

  const symbolUrl = await getSignedUrl("produktbilder", icon.symbol_path);

  async function action(prev: IconFormState, formData: FormData) {
    "use server";
    return updateIcon(id, prev, formData);
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Icon bearbeiten: {icon.label}</h1>
        <IconForm
          gruppen={gruppen.sort()}
          defaultValues={{
            label: icon.label,
            gruppe: icon.gruppe,
            sortierung: icon.sortierung,
            symbol_path: icon.symbol_path,
            symbol_url: symbolUrl,
          }}
          action={action}
          submitLabel="Speichern"
          redirectOnSuccess="/icons"
        />
      </div>
    </AppShell>
  );
}
