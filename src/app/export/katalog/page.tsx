import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { KatalogForm } from "./katalog-form";
import { JobStatusList } from "./job-status";

export const dynamic = "force-dynamic";

export default async function KatalogExportPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("katalog_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  const { data: einstellungen } = await supabase.from("katalog_einstellungen").select("wechselkurs_eur_chf").eq("id", 1).single();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gesamtkatalog exportieren</h1>
          <p className="text-muted-foreground">
            Generiert das komplette Katalog-PDF mit allen Bereichen, Kategorien und Produkten.
          </p>
        </div>
        <KatalogForm wechselkurs={Number(einstellungen?.wechselkurs_eur_chf ?? 1)} />
        <JobStatusList jobs={jobs ?? []} />
      </div>
    </AppShell>
  );
}
