import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";

export default function KundenDruckhistoriePage() {
  return (
    <AppShell>
      <PageHeader
        title="Druckhistorie (Kunden)"
        subtitle="Alle für Kunden generierten Kataloge und Datenblätter"
        breadcrumbs={[{ label: "Kunden", href: "/kunden" }, { label: "Druckhistorie" }]}
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <History className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Kommt mit PROJ-47</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Sobald die Kundendatenbank live ist, erscheint hier die kundenspezifische Druckhistorie.
            Die globale Druckhistorie aller Jobs ist weiterhin unter Lösungen → Druckhistorie (alle)
            erreichbar.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
