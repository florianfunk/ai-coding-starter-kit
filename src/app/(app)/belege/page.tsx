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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Belege</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aus Paperless importierte Dokumente inkl. OCR-Text. Grundlage für
          Klassifizierung und Beleg-Abgleich.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Die Belege konnten nicht geladen werden. Bitte lade die Seite neu.
          </AlertDescription>
        </Alert>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Noch keine Belege importiert.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Richte die Paperless-Verbindung ein und starte einen Sync.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/einstellungen/paperless">Zu Paperless</Link>
          </Button>
        </div>
      ) : (
        <BelegTabelle belege={(data ?? []) as BelegListItem[]} />
      )}
    </div>
  );
}
