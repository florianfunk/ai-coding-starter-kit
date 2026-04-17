import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { IconForm } from "../icon-form";
import { createIcon } from "../actions";

export default async function NewIconPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("icons")
    .select("gruppe")
    .not("gruppe", "is", null);
  const gruppen = Array.from(new Set((data ?? []).map((r) => r.gruppe).filter(Boolean))) as string[];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Neu anlegen"
        title="Neues Icon"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Icons", href: "/icons" },
          { label: "Neu" },
        ]}
      />
      <IconForm gruppen={gruppen.sort()} action={createIcon} submitLabel="Anlegen" redirectOnSuccess="/icons" />
    </AppShell>
  );
}
