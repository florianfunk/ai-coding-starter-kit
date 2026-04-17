import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { KategorieForm, type IconOption } from "../kategorie-form";
import { createKategorie } from "../actions";

export default async function NewKategoriePage({
  searchParams,
}: {
  searchParams: Promise<{ bereich?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: bereiche }, { data: icons }] = await Promise.all([
    supabase.from("bereiche").select("id,name").order("sortierung"),
    supabase.from("icons").select("id,label,gruppe,symbol_path").order("gruppe").order("sortierung").order("label"),
  ]);

  const iconOptions: IconOption[] = await Promise.all(
    (icons ?? []).map(async (ic: any) => ({
      id: ic.id, label: ic.label, gruppe: ic.gruppe,
      url: await getSignedUrl("produktbilder", ic.symbol_path),
    })),
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Neu anlegen"
        title="Neue Kategorie"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Kategorien", href: "/kategorien" },
          { label: "Neu" },
        ]}
      />
      <KategorieForm
        bereiche={bereiche ?? []}
        icons={iconOptions}
        defaultValues={sp.bereich ? { bereich_id: sp.bereich } : undefined}
        action={createKategorie}
        submitLabel="Anlegen"
      />
    </AppShell>
  );
}
