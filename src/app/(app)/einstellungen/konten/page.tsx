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
import { PageHeader, PageShell } from "@/components/layout/page-shell";

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
    <PageShell>
      <PageHeader
        eyebrow="Setup"
        titel="Bankkonten"
        beschreibung="Lege deine Konten an (Bank, PayPal, Kreditkarte) und konfiguriere pro Konto eine wiederverwendbare Spalten-Mapping-Vorlage für den Excel/CSV-Import."
        actions={
          <>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/einstellungen/konten/importe">Import-Historie</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/einstellungen/konten/import">Kontoauszug importieren</Link>
            </Button>
          </>
        }
      />

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
    </PageShell>
  );
}
