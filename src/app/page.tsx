import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lichtstudio</h1>
          <p className="text-muted-foreground">Interne Produktverwaltung für LICHT.ENGROS / Eisenkeil.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashboardCard href="/bereiche" title="Bereiche" description="20 Hauptkategorien des Katalogs verwalten." />
          <DashboardCard href="/kategorien" title="Kategorien" description="Untergliederung mit Icons und Vorschaubildern." />
          <DashboardCard href="/produkte" title="Produkte" description="Artikel mit allen technischen Daten pflegen." />
          <DashboardCard href="/einstellungen" title="Einstellungen" description="Filialen, Logos und Katalog-Parameter." />
        </div>
      </div>
    </AppShell>
  );
}

function DashboardCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-foreground/30">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </Link>
  );
}
