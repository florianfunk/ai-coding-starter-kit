// PROJ-4: Kontoauszug-Import-Seite (Server Component).
// Lädt die Konten des Eigentümers für die Auswahl und übergibt sie an die
// Client-Import-Komponente (Upload + Vorschau + Übernehmen).

import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import type { Konto } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ImportPanel } from "@/components/konten/import-panel";

export const metadata = {
  title: "Kontoauszug-Import · STEUERAGENT",
};

export default async function KontoImportPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("konto")
    .select("id, bezeichnung, typ, mapping")
    .eq("owner_id", user.id)
    .order("typ", { ascending: true })
    .order("bezeichnung", { ascending: true })
    .limit(100);

  const konten = (data ?? []) as Konto[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Kontoauszug-Import
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lade eine Excel- (.xlsx) oder CSV-Datei hoch. Zuerst wird eine
            Vorschau erzeugt (mit Duplikatmarkierung), erst danach werden die
            Buchungen übernommen.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/einstellungen/konten">Zu den Konten</Link>
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Die Konten konnten nicht geladen werden. Bitte lade die Seite neu.
          </AlertDescription>
        </Alert>
      ) : konten.length === 0 ? (
        <Alert>
          <AlertTitle>Noch kein Konto vorhanden</AlertTitle>
          <AlertDescription>
            Lege zuerst ein Konto inklusive Spalten-Mapping an, bevor du einen
            Kontoauszug importieren kannst.{" "}
            <Link
              href="/einstellungen/konten"
              className="font-medium underline underline-offset-2"
            >
              Konto anlegen
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <ImportPanel konten={konten} />
      )}
    </div>
  );
}
