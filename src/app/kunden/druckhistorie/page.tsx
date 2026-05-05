import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { DruckhistorieTable } from "../druckhistorie-table";

export default async function GlobaleKundenDruckhistorie() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("katalog_jobs")
    .select(
      "id, status, typ, kunde_id, produkt_id, parameter, pdf_path, error_text, created_at, kunden(id, firma, kunden_nr)",
    )
    .not("kunde_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <AppShell>
      <PageHeader
        title="Druckhistorie (Kunden)"
        subtitle="Alle Kataloge und Datenblätter, die für Kunden generiert wurden."
        breadcrumbs={[
          { label: "Kunden", href: "/kunden" },
          { label: "Druckhistorie" },
        ]}
      />
      <Card>
        <CardContent className="py-4">
          <DruckhistorieTable jobs={(jobs ?? []) as never} showKunde />
        </CardContent>
      </Card>
    </AppShell>
  );
}
