// PROJ-14: Kategorien-Analyse — Übersicht & Inline-Bearbeitung.
// Server Component: lädt nur Filter-Stammdaten (Konten + Jahre); die
// eigentlichen Aggregat-Daten holt die Client-Komponente per fetch
// (damit Filter-Wechsel ohne Page-Reload funktionieren).

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { KategorienAnalyseAnsicht } from "@/components/kategorien-analyse/kategorien-analyse-ansicht";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kategorien-Analyse · STEUERAGENT",
};

export default async function KategorienAnalysePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: konten }, { data: jahreData }] = await Promise.all([
    supabase
      .from("konto")
      .select("id, bezeichnung, typ")
      .eq("owner_id", user.id)
      .order("bezeichnung")
      .limit(50),
    supabase
      .from("buchung")
      .select("buchung_datum")
      .eq("owner_id", user.id)
      .order("buchung_datum", { ascending: false })
      .limit(10000),
  ]);

  const jahre = Array.from(
    new Set(
      ((jahreData ?? []) as Array<{ buchung_datum: string }>).map(
        (r) => Number(r.buchung_datum.slice(0, 4)),
      ),
    ),
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Kategorien-Analyse
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buchungen je EÜR-Kategorie mit Summen und Konfidenz. Klick auf eine
          Kategorie öffnet die Liste — Korrekturen direkt inline.
        </p>
      </div>

      <KategorienAnalyseAnsicht
        konten={(konten ?? []) as Array<{
          id: string;
          bezeichnung: string;
          typ: "bank" | "paypal" | "kreditkarte";
        }>}
        jahre={jahre}
      />
    </div>
  );
}
