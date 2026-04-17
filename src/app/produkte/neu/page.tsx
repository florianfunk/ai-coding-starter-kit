import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
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
    supabase.from("icons").select("id,label,gruppe,symbol_path").order("gruppe").order("sortierung").order("label"),
  ]);
  const iconsFull = await Promise.all(
    (icons ?? []).map(async (ic: any) => ({
      id: ic.id, label: ic.label, gruppe: ic.gruppe,
      url: await getSignedUrl("produktbilder", ic.symbol_path),
    })),
  );

  let defaults: Record<string, any> | undefined;
  if (sp.kategorie) {
    const kat = (kategorien ?? []).find((k) => k.id === sp.kategorie);
    if (kat) defaults = { kategorie_id: kat.id, bereich_id: kat.bereich_id };
  } else if (sp.bereich) {
    defaults = { bereich_id: sp.bereich };
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Neu anlegen"
        title="Neues Produkt"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Produkte", href: "/produkte" },
          { label: "Neu" },
        ]}
      />
      <ProduktForm
        bereiche={bereiche ?? []}
        kategorien={kategorien ?? []}
        icons={iconsFull}
        defaultValues={defaults}
        action={createProdukt}
        submitLabel="Anlegen"
      />
    </AppShell>
  );
}
