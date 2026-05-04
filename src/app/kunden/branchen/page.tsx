import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tag } from "lucide-react";

export default function KundenBranchenPage() {
  return (
    <AppShell>
      <PageHeader
        title="Branchen"
        subtitle="Branchen-Tags zur Kategorisierung der Kunden pflegen"
        breadcrumbs={[{ label: "Kunden", href: "/kunden" }, { label: "Branchen" }]}
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Tag className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Kommt mit PROJ-47</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Die zentrale Branchen-Verwaltung (Anlegen, Bearbeiten, Löschen) wird zusammen mit der
            Kundendatenbank ausgeliefert.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
