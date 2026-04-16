import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground hover:text-primary hover:bg-primary/5">
        <Link href="/icons"><ChevronLeft className="h-4 w-4 mr-1" /> Alle Icons</Link>
      </Button>
      <PageHeader eyebrow="Neu anlegen" title="Neues Icon" />
      <IconForm gruppen={gruppen.sort()} action={createIcon} submitLabel="Anlegen" redirectOnSuccess="/icons" />
    </AppShell>
  );
}
