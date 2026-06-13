// Import-Historie: Liste aller Konto-Import-Laeufe mit Undo-Moeglichkeit.
//
// Server Component — laedt die Historie initial. Re-Fetch + Undo passieren
// im Client (ImportHistorie).

import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { Button } from "@/components/ui/button";
import { ImportHistorie } from "@/components/konten/import-historie";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

export const metadata = {
  title: "Import-Historie · STEUERAGENT",
};

export default async function ImporteHistoriePage() {
  await requireUser();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Setup"
        titel="Import-Historie"
        beschreibung="Protokoll aller hochgeladenen Kontoauszüge. Wenn ein Import fehlerhaft war oder du ihn neu laden möchtest, kannst du genau diesen Import rückgängig machen — gelöscht werden nur die Buchungen aus diesem Lauf."
        actions={
          <>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/einstellungen/konten">Zurück zu den Konten</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/einstellungen/konten/import">Neuen Import starten</Link>
            </Button>
          </>
        }
      />

      <ImportHistorie />
    </PageShell>
  );
}
