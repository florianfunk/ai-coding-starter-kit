import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { AuditTable } from "./audit-table";

export default async function AktivitaetPage({
  searchParams,
}: {
  searchParams: Promise<{ tabelle?: string }>;
}) {
  const { tabelle } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (tabelle && tabelle !== "alle") {
    query = query.eq("table_name", tabelle);
  }

  const { data: entries } = await query;

  return (
    <AppShell>
      <PageHeader
        title="Letzte Aenderungen"
        subtitle="Protokoll aller Aenderungen an Bereichen, Kategorien und Produkten"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Aktivitaet" },
        ]}
      />
      <AuditTable entries={entries ?? []} currentFilter={tabelle ?? "alle"} />
    </AppShell>
  );
}
