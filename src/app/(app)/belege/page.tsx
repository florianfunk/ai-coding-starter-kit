// PROJ-3: Belege-Übersicht (Server Component).
// Lädt die aus Paperless importierten Belege owner-scoped (RLS + explizit)
// mit .limit() und übergibt sie an die Client-Tabelle.

import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BelegTabelle } from "@/components/belege/beleg-tabelle";
import type { BelegListItem } from "@/components/belege/beleg-tabelle";
import { EmptyState, PageHeader, PageShell } from "@/components/layout/page-shell";

export const metadata = {
  title: "Belege · STEUERAGENT",
};

export default async function BelegePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("beleg")
    .select(
      "id, paperless_id, titel, beleg_datum, korrespondent, betrag, tags, dokumenttyp, ocr_text, quell_link, status",
    )
    .eq("owner_id", user.id)
    .order("beleg_datum", { ascending: false, nullsFirst: false })
    .limit(1000);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Bücher"
        titel="Belege"
        beschreibung="Aus Paperless importierte Dokumente inkl. OCR-Text. Grundlage für Klassifizierung und Beleg-Abgleich."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Die Belege konnten nicht geladen werden. Bitte lade die Seite neu.
          </AlertDescription>
        </Alert>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          titel="Noch keine Belege importiert"
          beschreibung="Richte die Paperless-Verbindung ein und starte einen Sync."
          action={
            <Button asChild variant="default">
              <Link href="/einstellungen/paperless">Zu Paperless</Link>
            </Button>
          }
        />
      ) : (
        <BelegTabelle belege={(data ?? []) as BelegListItem[]} />
      )}
    </PageShell>
  );
}
