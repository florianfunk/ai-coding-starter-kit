import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function KundenPage() {
  return (
    <AppShell>
      <PageHeader
        title="Kundenliste"
        subtitle="Kunden mit individuellen Auswahlen und Preisen verwalten"
        breadcrumbs={[{ label: "Kunden" }]}
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Kundendatenbank kommt mit PROJ-47</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Hier wird in Kürze die Liste aller Kunden erscheinen. Die Workspace-Navigation steht
            bereits — die Kundendatenbank selbst (Stammdaten, Auswahl, Preise, Druckhistorie)
            wird im nächsten Schritt gebaut.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
