import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { KategorieForm } from "../kategorie-form";
import { createKategorie } from "../actions";

export default async function NewKategoriePage() {
  const supabase = await createClient();
  const [{ data: bereiche }, { data: icons }] = await Promise.all([
    supabase.from("bereiche").select("id,name").order("sortierung"),
    supabase.from("icons").select("id,label").order("label"),
  ]);
  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Neue Kategorie</h1>
        <KategorieForm bereiche={bereiche ?? []} icons={icons ?? []} action={createKategorie} submitLabel="Anlegen" />
      </div>
    </AppShell>
  );
}
