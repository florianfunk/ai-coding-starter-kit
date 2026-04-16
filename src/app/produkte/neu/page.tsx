import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { ProduktForm } from "../produkt-form";
import { createProdukt } from "../actions";

export default async function NewProduktPage({
  searchParams,
}: {
  searchParams: Promise<{ kategorie?: string; bereich?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: bereiche }, { data: kategorien }, { data: icons }] = await Promise.all([
    supabase.from("bereiche").select("id,name").order("sortierung"),
    supabase.from("kategorien").select("id,name,bereich_id").order("name"),
    supabase.from("icons").select("id,label,gruppe,symbol_path").order("gruppe").order("sortierung").order("label"),
  ]);
  const iconsFull = await Promise.all(
    (icons ?? []).map(async (ic: any) => ({
      id: ic.id, label: ic.label, gruppe: ic.gruppe,
      url: await getSignedUrl("produktbilder", ic.symbol_path),
    })),
  );

  let defaults: Record<string, any> | undefined;
  if (sp.kategorie) {
    const kat = (kategorien ?? []).find((k) => k.id === sp.kategorie);
    if (kat) defaults = { kategorie_id: kat.id, bereich_id: kat.bereich_id };
  } else if (sp.bereich) {
    defaults = { bereich_id: sp.bereich };
  }

  const backHref = sp.kategorie
    ? `/kategorien/${sp.kategorie}`
    : sp.bereich ? `/bereiche/${sp.bereich}` : "/produkte";
  const backLabel = sp.kategorie ? "Zurück zur Kategorie" : sp.bereich ? "Zurück zum Bereich" : "Alle Produkte";

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground hover:text-primary hover:bg-primary/5">
        <Link href={backHref}><ChevronLeft className="h-4 w-4 mr-1" /> {backLabel}</Link>
      </Button>
      <PageHeader eyebrow="Neu anlegen" title="Neues Produkt" />
      <ProduktForm
        bereiche={bereiche ?? []}
        kategorien={kategorien ?? []}
        icons={iconsFull}
        defaultValues={defaults}
        action={createProdukt}
        submitLabel="Anlegen"
      />
    </AppShell>
  );
}
