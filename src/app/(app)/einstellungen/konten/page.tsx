// PROJ-4: Bankkonten-Seite (Server Component).
// Lädt alle Konten des Eigentümers (RLS-geschützt) und übergibt sie an die
// Client-Tabelle (Anlegen/Bearbeiten + Mapping-Editor + Import-Verweis).

import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import type { Konto } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { KontenTabelle } from "@/components/konten/konten-tabelle";

export const metadata = {
  title: "Bankkonten · STEUERAGENT",
};

export default async function KontenPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("konto")
    .select("id, bezeichnung, typ, mapping")
    .eq("owner_id", user.id)
    .order("typ", { ascending: true })
    .order("bezeichnung", { ascending: true })
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bankkonten</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lege deine Konten an (Bank, PayPal, Kreditkarte) und konfiguriere
            pro Konto eine wiederverwendbare Spalten-Mapping-Vorlage für den
            Excel/CSV-Import.
          </p>
        </div>
        <Button asChild>
          <Link href="/einstellungen/konten/import">Kontoauszug importieren</Link>
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Die Konten konnten nicht geladen werden. Bitte lade die Seite neu.
          </AlertDescription>
        </Alert>
      ) : (
        <KontenTabelle initialKonten={(data ?? []) as Konto[]} />
      )}
    </div>
  );
}
