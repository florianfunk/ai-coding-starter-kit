import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { BranchenList } from "./branchen-list";

export default async function BranchenPage() {
  const supabase = await createClient();

  const { data: branchen } = await supabase
    .from("kunden_branchen")
    .select("id, name, kunde_branche(count)")
    .order("name");

  const items = (branchen ?? []).map((b) => ({
    id: b.id as string,
    name: b.name as string,
    count: ((b.kunde_branche as Array<{ count: number }> | null) ?? [])[0]?.count ?? 0,
  }));

  return (
    <AppShell>
      <PageHeader
        title="Branchen"
        subtitle="Tags zur Kategorisierung der Kunden — pro Branche siehst du, wie viele Kunden sie nutzen."
        breadcrumbs={[
          { label: "Kunden", href: "/kunden" },
          { label: "Branchen" },
        ]}
      />
      <Card>
        <CardContent className="py-4">
          <BranchenList items={items} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
