// PROJ-12: Dashboard — Startseite nach Login (Server Component).
//
// Lädt das aggregierte Kennzahl-Objekt direkt serverseitig (gemeinsame
// Lade-/Aggregations-Funktion, dieselbe Quelle wie /api/dashboard) und
// rendert die Kacheln. Ohne Daten: Onboarding-Leerzustand.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { ladeDashboardAggregat } from "@/lib/dashboard/load";
import { onboardingVollstaendig } from "@/lib/dashboard/aggregate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardEditorial } from "@/components/dashboard/dashboard-editorial";
import { Onboarding } from "@/components/dashboard/onboarding";
import { formatZeitpunkt } from "@/components/dashboard/format";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

export const metadata = {
  title: "Dashboard · STEUERAGENT",
};

// Immer frisch aggregieren — Kennzahlen sollen den aktuellen Stand zeigen.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  let aggregat = null;
  let ladeFehler = false;
  try {
    aggregat = await ladeDashboardAggregat(supabase, user.id);
  } catch {
    ladeFehler = true;
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Übersicht"
        titel="Dashboard"
        beschreibung="Was Aufmerksamkeit braucht, wo dein Jahr steht und wann zuletzt etwas importiert wurde."
        actions={
          aggregat && !ladeFehler ? (
            <span className="text-xs text-muted-foreground">
              Stand: {formatZeitpunkt(aggregat.stand)}
            </span>
          ) : undefined
        }
      />

      {ladeFehler || !aggregat ? (
        <Alert variant="destructive">
          <AlertTitle>Dashboard konnte nicht geladen werden</AlertTitle>
          <AlertDescription>
            Die Kennzahlen konnten nicht aggregiert werden. Bitte lade die
            Seite neu.
          </AlertDescription>
        </Alert>
      ) : !onboardingVollstaendig(aggregat.onboarding) ? (
        <>
          <Onboarding status={aggregat.onboarding} />
          {!aggregat.ist_leer && <DashboardEditorial data={aggregat} />}
        </>
      ) : (
        <DashboardEditorial data={aggregat} />
      )}
    </PageShell>
  );
}
