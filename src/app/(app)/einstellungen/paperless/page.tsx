// PROJ-3: Paperless-Verbindungs- & Sync-Seite (Server Component).
// Lädt Verbindungs-Status (ohne Klartext-Token) und letzten Sync-Job
// serverseitig (RLS-geschützt) und übergibt sie an die Client-Komponente.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PaperlessPanel } from "@/components/paperless/paperless-panel";
import type { JobLauf } from "@/lib/types";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

export const metadata = {
  title: "Paperless · STEUERAGENT",
};

export interface VerbindungStatus {
  base_url: string;
  token_gesetzt: boolean;
  last_sync_at: string | null;
}

export default async function PaperlessPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: verbRow, error: verbError } = await supabase
    .from("paperless_verbindung")
    .select("base_url, token_cipher, last_sync_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  const verbindung: VerbindungStatus | null = verbRow
    ? {
        base_url: (verbRow as { base_url: string }).base_url,
        token_gesetzt:
          ((verbRow as { token_cipher: string }).token_cipher ?? "").length >
          0,
        last_sync_at:
          (verbRow as { last_sync_at: string | null }).last_sync_at ?? null,
      }
    : null;

  const { data: jobRow } = await supabase
    .from("job_lauf")
    .select(
      "id, art, status, fortschritt, gesamt, ergebnis, fehler_text, created_at",
    )
    .eq("owner_id", user.id)
    .eq("art", "paperless_sync")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <PageShell className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Setup"
        titel="Paperless"
        beschreibung="Verbinde STEUERAGENT mit deiner Paperless-ngx-Instanz und importiere Belege inkl. OCR-Text. Der API-Token wird verschlüsselt gespeichert und nie im Klartext angezeigt."
      />

      {verbError && (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Die gespeicherte Verbindung konnte nicht geladen werden. Du kannst
            sie unten neu erfassen.
          </AlertDescription>
        </Alert>
      )}

      <PaperlessPanel
        initialVerbindung={verbindung}
        initialJob={(jobRow as JobLauf | null) ?? null}
      />
    </PageShell>
  );
}
