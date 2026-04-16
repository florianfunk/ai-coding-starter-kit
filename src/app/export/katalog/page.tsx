import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        eyebrow="PDF-Export"
        title="Gesamtkatalog exportieren"
        subtitle="Generiert das komplette Katalog-PDF mit allen Bereichen, Kategorien und Produkten"
      />
      <div className="space-y-6">
        <KatalogForm wechselkurs={Number(einstellungen?.wechselkurs_eur_chf ?? 1)} />
        <JobStatusList jobs={jobs ?? []} />
      </div>
    </AppShell>
  );
}
