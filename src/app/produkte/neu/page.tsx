import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { ProduktForm } from "../produkt-form";
import { createProdukt } from "../actions";

export default async function NewProduktPage() {
  const supabase = await createClient();
  const [{ data: bereiche }, { data: kategorien }, { data: icons }] = await Promise.all([
    supabase.from("bereiche").select("id,name").order("sortierung"),
    supabase.from("kategorien").select("id,name,bereich_id").order("name"),
    supabase.from("icons").select("id,label").order("label"),
  ]);
  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Neues Produkt</h1>
        <ProduktForm
          bereiche={bereiche ?? []}
          kategorien={kategorien ?? []}
          icons={icons ?? []}
          action={createProdukt}
          submitLabel="Anlegen"
        />
      </div>
    </AppShell>
  );
}
