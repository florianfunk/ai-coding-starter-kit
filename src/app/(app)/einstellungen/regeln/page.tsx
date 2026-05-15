// PROJ-7: Lernregel-Verwaltung (Server Component).
// Lädt alle Regeln des Eigentümers + Konten/Kategorien für Editor & Anzeige.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import type { Kategorie, Konto, Lernregel } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RegelnTabelle } from "@/components/regeln/regeln-tabelle";

export const metadata = {
  title: "Lernregeln · STEUERAGENT",
};

export default async function RegelnPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: kontenData } = await supabase
    .from("konto")
    .select("id, bezeichnung, typ, mapping")
    .eq("owner_id", user.id)
    .order("bezeichnung", { ascending: true })
    .limit(100);
  const konten = (kontenData ?? []) as Konto[];

  const { data: kategorienData } = await supabase
    .from("kategorie")
    .select(
      "id, bezeichnung, typ, ust_satz, euer_zeile, elster_kennzahl, aktiv, gueltig_ab",
    )
    .eq("owner_id", user.id)
    .order("bezeichnung", { ascending: true })
    .limit(500);
  const kategorien = (kategorienData ?? []) as Kategorie[];

  const { data, error } = await supabase
    .from("lernregel")
    .select(
      "id, bezeichnung, bedingung, aktion, prioritaet, aktiv, treffer_zaehler",
    )
    .eq("owner_id", user.id)
    .order("prioritaet", { ascending: false })
    .order("bezeichnung", { ascending: true })
    .limit(1000);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lernregeln</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deterministische Regeln mit Vorrang vor der KI. Höhere Priorität
          gewinnt; widersprechen sich Regeln gleicher Priorität, landet der
          Fall in der Prüfliste.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Die Lernregeln konnten nicht geladen werden. Bitte lade die Seite
            neu.
          </AlertDescription>
        </Alert>
      ) : (
        <RegelnTabelle
          initialRegeln={(data ?? []) as Lernregel[]}
          konten={konten}
          kategorien={kategorien}
        />
      )}
    </div>
  );
}
