import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Printer } from "lucide-react";
import { JobStatusList } from "./job-status";

export const dynamic = "force-dynamic";

export default async function KatalogExportPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("katalog_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <AppShell>
      <PageHeader
        eyebrow="PDF-Export"
        title="Gesamtkatalog exportieren"
        subtitle="Übersicht aller Katalog-Generierungs-Jobs (Status, Download, Verlauf)"
      />
      <div className="space-y-6">
        <Alert>
          <Printer className="h-4 w-4" />
          <AlertDescription>
            Neue Kataloge erstellst du jetzt über den Wizard: <Link href="/produkte" className="font-medium underline underline-offset-4">Produkte → Katalog drucken</Link>.
          </AlertDescription>
        </Alert>
        <JobStatusList jobs={jobs ?? []} />
      </div>
    </AppShell>
  );
}
