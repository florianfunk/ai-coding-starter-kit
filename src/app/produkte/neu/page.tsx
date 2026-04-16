import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { ProduktForm } from "../produkt-form";
import { createProdukt } from "../actions";

export default async function NewProduktPage({
  searchParams,
}: {
  searchParams: Promise<{ kategorie?: string; bereich?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: bereiche }, { data: kategorien }, { data: icons }] = await Promise.all([
    supabase.from("bereiche").select("id,name").order("sortierung"),
    supabase.from("kategorien").select("id,name,bereich_id").order("name"),
    supabase.from("icons").select("id,label").order("label"),
  ]);

  // If ?kategorie=... is passed, derive bereich_id from the kategorie
  let defaults: Record<string, any> | undefined;
  if (sp.kategorie) {
    const kat = (kategorien ?? []).find((k) => k.id === sp.kategorie);
    if (kat) defaults = { kategorie_id: kat.id, bereich_id: kat.bereich_id };
  } else if (sp.bereich) {
    defaults = { bereich_id: sp.bereich };
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Neues Produkt</h1>
        <ProduktForm
          bereiche={bereiche ?? []}
          kategorien={kategorien ?? []}
          icons={icons ?? []}
          defaultValues={defaults}
          action={createProdukt}
          submitLabel="Anlegen"
        />
      </div>
    </AppShell>
  );
}
