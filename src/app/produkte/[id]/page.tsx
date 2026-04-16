import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { ProduktForm } from "../produkt-form";
import { updateProdukt, type ProduktFormState } from "../actions";
import { ProduktTopActions } from "./top-actions";
import { PreiseSection } from "./preise-section";
import { GalerieSection } from "./galerie-section";

export default async function ProduktDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: produkt } = await supabase.from("produkte").select("*").eq("id", id).single();
  if (!produkt) notFound();

  const [{ data: bereiche }, { data: kategorien }, { data: icons }, { data: produktIcons }, { data: galerie }, { data: preise }] =
    await Promise.all([
      supabase.from("bereiche").select("id,name").order("sortierung"),
      supabase.from("kategorien").select("id,name,bereich_id").order("name"),
      supabase.from("icons").select("id,label").order("label"),
      supabase.from("produkt_icons").select("icon_id").eq("produkt_id", id),
      supabase.from("produkt_bilder").select("*").eq("produkt_id", id).order("sortierung"),
      supabase.from("preise").select("*").eq("produkt_id", id).order("gueltig_ab", { ascending: false }),
    ]);

  const hauptbildUrl = await getSignedUrl("produktbilder", produkt.hauptbild_path);
  const galerieMit = await Promise.all(
    (galerie ?? []).map(async (g) => ({ ...g, url: await getSignedUrl("produktbilder", g.storage_path) })),
  );

  async function action(prev: ProduktFormState, formData: FormData) {
    "use server";
    return updateProdukt(id, prev, formData);
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Produkt</p>
            <h1 className="text-2xl font-semibold tracking-tight font-mono">{produkt.artikelnummer}</h1>
            <p className="text-muted-foreground">{produkt.name ?? "—"}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/produkte/${id}/datenblatt`}>Datenblatt PDF</Link>
            </Button>
            <ProduktTopActions id={id} />
          </div>
        </div>

        <ProduktForm
          bereiche={bereiche ?? []}
          kategorien={kategorien ?? []}
          icons={icons ?? []}
          defaultValues={produkt}
          defaultIconIds={(produktIcons ?? []).map((r) => r.icon_id)}
          defaultHauptbildUrl={hauptbildUrl}
          produktId={id}
          action={action}
          submitLabel="Speichern"
        />

        <PreiseSection produktId={id} preise={preise ?? []} />
        <GalerieSection produktId={id} bilder={galerieMit} />
      </div>
    </AppShell>
  );
}
