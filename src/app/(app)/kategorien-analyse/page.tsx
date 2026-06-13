// PROJ-14: Kategorien-Analyse — Übersicht & Inline-Bearbeitung.
// Server Component: lädt nur Filter-Stammdaten (Konten); Aggregat-Daten
// und Drill-Down holt die Client-Komponente per fetch (damit Filter-
// Wechsel ohne Page-Reload funktionieren).

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { KategorienAnalyseAnsicht } from "@/components/kategorien-analyse/kategorien-analyse-ansicht";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kategorien-Analyse · STEUERAGENT",
};

export default async function KategorienAnalysePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: konten } = await supabase
    .from("konto")
    .select("id, bezeichnung, typ")
    .eq("owner_id", user.id)
    .order("bezeichnung")
    .limit(50);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Bücher"
        titel="Kategorien-Analyse"
        beschreibung="Buchungen je EÜR-Kategorie mit Summen und Konfidenz. Klick auf eine Kategorie öffnet die Liste — Korrekturen direkt inline."
      />

      <KategorienAnalyseAnsicht
        konten={(konten ?? []) as Array<{
          id: string;
          bezeichnung: string;
          typ: "bank" | "paypal" | "kreditkarte";
        }>}
      />
    </PageShell>
  );
}
