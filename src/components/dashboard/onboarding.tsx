// PROJ-12: Onboarding-Leerzustand — wird gezeigt, wenn noch keine Daten
// (keine Konten, keine Buchungen, keine Belege) vorhanden sind. Führt den
// Inhaber Schritt für Schritt durch die Ersteinrichtung. Server-renderbar.

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SCHRITTE: { titel: string; text: string; href: string; cta: string }[] =
  [
    {
      titel: "1. Firmen- & Steuerprofil",
      text: "Rechtsform, USt-Status, Wirtschaftsjahr und USt-VA-Rhythmus festlegen.",
      href: "/einstellungen/firma",
      cta: "Profil einrichten",
    },
    {
      titel: "2. Kontenrahmen",
      text: "EÜR-Kategorien anlegen oder Standard-Kontenrahmen übernehmen.",
      href: "/einstellungen/kontenrahmen",
      cta: "Kontenrahmen öffnen",
    },
    {
      titel: "3. Paperless verbinden",
      text: "Paperless-ngx anbinden, damit Belege automatisch importiert werden.",
      href: "/einstellungen/paperless",
      cta: "Paperless verbinden",
    },
    {
      titel: "4. Bankkonten anlegen",
      text: "Bank-, PayPal- und Kreditkartenkonten mit Spalten-Mapping anlegen.",
      href: "/einstellungen/konten",
      cta: "Konten anlegen",
    },
    {
      titel: "5. Kontoauszug importieren",
      text: "Excel/CSV-Kontoauszug hochladen — die Buchungen werden eingelesen.",
      href: "/einstellungen/konten",
      cta: "Import starten",
    },
    {
      titel: "6. Klassifizierung starten",
      text: "Der Agent ordnet die Buchungen autonom zu; Ausnahmen landen in der Prüfliste.",
      href: "/buchungen",
      cta: "Zu den Buchungen",
    },
  ];

export function Onboarding() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Willkommen beim STEUERAGENT</CardTitle>
          <CardDescription>
            Es wurden noch keine Daten erfasst. Richte die folgenden Schritte
            ein, damit der Agent deine Buchhaltung übernehmen kann.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SCHRITTE.map((s) => (
              <li
                key={s.href + s.titel}
                className="flex flex-col rounded-md border p-4"
              >
                <h3 className="text-sm font-semibold">{s.titel}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">
                  {s.text}
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                >
                  <Link href={s.href}>{s.cta}</Link>
                </Button>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
