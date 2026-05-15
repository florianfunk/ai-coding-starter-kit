// PROJ-12: Dashboard — Startseite nach Login (Server Component).
//
// Lädt das aggregierte Kennzahl-Objekt direkt serverseitig (gemeinsame
// Lade-/Aggregations-Funktion, dieselbe Quelle wie /api/dashboard) und
// rendert die Kacheln. Ohne Daten: Onboarding-Leerzustand.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { ladeDashboardAggregat } from "@/lib/dashboard/load";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { Onboarding } from "@/components/dashboard/onboarding";
import { formatZeitpunkt } from "@/components/dashboard/format";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buchhaltungsstand auf einen Blick. Jede Kachel führt direkt zur
          zugehörigen Ansicht.
        </p>
      </div>

      {ladeFehler || !aggregat ? (
        <Alert variant="destructive">
          <AlertTitle>Dashboard konnte nicht geladen werden</AlertTitle>
          <AlertDescription>
            Die Kennzahlen konnten nicht aggregiert werden. Bitte lade die
            Seite neu.
          </AlertDescription>
        </Alert>
      ) : aggregat.ist_leer ? (
        <Onboarding />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Stand: {formatZeitpunkt(aggregat.stand)}
          </p>
          <DashboardGrid data={aggregat} />
        </>
      )}
    </div>
  );
}
