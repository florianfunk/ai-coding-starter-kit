import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { bildProxyUrl } from "@/lib/bild-url";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CompareTable } from "./compare-table";

export const dynamic = "force-dynamic";

export default async function VergleichPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const sp = await searchParams;
  const ids = (sp.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (ids.length < 2) {
    redirect("/produkte");
  }

  const supabase = await createClient();

  // Load products with all fields
  const { data: produkte, error: produkteError } = await supabase
    .from("produkte")
    .select("*")
    .in("id", ids);

  if (produkteError || !produkte || produkte.length < 2) {
    redirect("/produkte");
  }

  // Load current prices for these products
  const { data: preise } = await supabase
    .from("aktuelle_preise_flat")
    .select("produkt_id, listenpreis, ek")
    .in("produkt_id", ids);

  const preisMap: Record<string, { listenpreis: number | null; ek: number | null }> = {};
  for (const p of preise ?? []) {
    preisMap[p.produkt_id] = { listenpreis: p.listenpreis, ek: p.ek };
  }

  // Load bereich and kategorie names
  const bereichIds = [...new Set(produkte.map((p) => p.bereich_id))];
  const kategorieIds = [...new Set(produkte.map((p) => p.kategorie_id))];

  const [{ data: bereiche }, { data: kategorien }] = await Promise.all([
    supabase.from("bereiche").select("id,name").in("id", bereichIds),
    supabase.from("kategorien").select("id,name").in("id", kategorieIds),
  ]);

  const bereichMap = Object.fromEntries((bereiche ?? []).map((b) => [b.id, b.name]));
  const kategorieMap = Object.fromEntries((kategorien ?? []).map((k) => [k.id, k.name]));

  // Keep products in the same order as the IDs
  const orderedProdukte = ids
    .map((id) => produkte.find((p) => p.id === id))
    .filter(Boolean) as typeof produkte;

  // Resolve image URLs via Proxy (stabile URLs fürs Optimizer-Caching).
  const imageUrlMap: Record<string, string | null> = {};
  for (const p of orderedProdukte) {
    imageUrlMap[p.id] = bildProxyUrl("produktbilder", p.hauptbild_path);
  }

  return (
    <AppShell>
      <PageHeader
        title="Produktvergleich"
        subtitle={`${orderedProdukte.length} Produkte im Vergleich`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Produkte", href: "/produkte" },
          { label: "Vergleich" },
        ]}
      >
        <Button asChild variant="outline" size="lg">
          <Link href="/produkte">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurueck zur Liste
          </Link>
        </Button>
      </PageHeader>

      <div className="glass-card overflow-x-auto">
        <CompareTable
          produkte={orderedProdukte}
          preisMap={preisMap}
          bereichMap={bereichMap}
          kategorieMap={kategorieMap}
          imageUrlMap={imageUrlMap}
        />
      </div>
    </AppShell>
  );
}
