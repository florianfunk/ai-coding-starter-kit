import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import type { Kategorie } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KontenrahmenTabelle } from "@/components/kontenrahmen/kontenrahmen-tabelle";

export const metadata = {
  title: "Kontenrahmen · STEUERAGENT",
};

export default async function KontenrahmenPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kategorie")
    .select(
      "id, bezeichnung, typ, ust_satz, euer_zeile, elster_kennzahl, aktiv, gueltig_ab",
    )
    .eq("owner_id", user.id)
    .order("typ", { ascending: true })
    .order("bezeichnung", { ascending: true })
    .limit(500);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Kontenrahmen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Definiere die EÜR-Zielsystematik: Kategorien mit Typ, USt-Satz und
          ELSTER-Zuordnung. Diese Kategorien nutzen alle weiteren Module.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Der Kontenrahmen konnte nicht geladen werden. Bitte lade die Seite
            neu.
          </AlertDescription>
        </Alert>
      ) : (
        <KontenrahmenTabelle
          initialKategorien={(data ?? []) as Kategorie[]}
        />
      )}
    </div>
  );
}
