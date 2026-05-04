import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown } from "lucide-react";

export default function KundenSonderpreisePage() {
  return (
    <AppShell>
      <PageHeader
        title="Sonderpreise"
        subtitle="Übersicht aller Kunden mit individuellem Aufschlag oder Rabatt"
        breadcrumbs={[{ label: "Kunden", href: "/kunden" }, { label: "Sonderpreise" }]}
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <TrendingDown className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Kommt mit PROJ-47</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Diese Übersicht zeigt später alle Kunden mit Sonderkonditionen — gewählte Preisspur,
            Aufschlag oder Rabatt in Prozent.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
