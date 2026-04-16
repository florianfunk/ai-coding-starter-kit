import { AppShell } from "@/components/app-shell";
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
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Neues Icon</h1>
        <IconForm gruppen={gruppen.sort()} action={createIcon} submitLabel="Anlegen" redirectOnSuccess="/icons" />
      </div>
    </AppShell>
  );
}
