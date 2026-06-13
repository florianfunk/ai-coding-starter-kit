// PROJ-1: Firmen-/Steuerprofil-Seite (Server Component).
// Lädt das vorhandene Profil serverseitig (RLS-geschützt) und übergibt es
// an das Client-Formular. Kein Profil -> leeres Formular.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FirmaForm } from "@/components/firma/firma-form";
import type { Firmenprofil } from "@/lib/types";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

export const metadata = {
  title: "Firma & Steuerprofil — STEUERAGENT",
};

export default async function FirmaPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("firmenprofil")
    .select(
      "id, firmenname, inhaber, steuernummer, ust_idnr, strasse, plz, ort, finanzamt, rechtsform, ust_status, wirtschaftsjahr_beginn, ust_va_rhythmus, rhythmus_gueltig_ab",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  const profil = (data as Firmenprofil | null) ?? null;

  return (
    <PageShell className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Setup"
        titel="Firma & Steuerprofil"
        beschreibung="Zentrale Stammdaten und Steuerprofil deiner Firma. Single Source of Truth für alle weiteren Module."
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Das gespeicherte Profil konnte nicht geladen werden. Du kannst es
            unten neu erfassen und speichern.
          </AlertDescription>
        </Alert>
      )}

      <FirmaForm initialProfil={profil} />
    </PageShell>
  );
}
