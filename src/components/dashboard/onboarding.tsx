// PROJ-12 / PROJ-13: Onboarding mit Fortschrittsanzeige. Zeigt die 6
// Ersteinrichtungs-Schritte mit Status: erledigt (Häkchen), aktuell
// (hervorgehoben) oder offen. Bleibt sichtbar bis alle Schritte erledigt
// sind. Server-renderbar.

import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OnboardingStatus } from "@/lib/dashboard/aggregate";

type SchrittKey = keyof OnboardingStatus;

const SCHRITTE: {
  key: SchrittKey;
  titel: string;
  text: string;
  href: string;
  cta: string;
}[] = [
  {
    key: "profil",
    titel: "1. Firmen- & Steuerprofil",
    text: "Rechtsform, USt-Status, Wirtschaftsjahr und USt-VA-Rhythmus festlegen.",
    href: "/einstellungen/firma",
    cta: "Profil einrichten",
  },
  {
    key: "kontenrahmen",
    titel: "2. Kontenrahmen",
    text: "EÜR-Kategorien anlegen oder Standard-Kontenrahmen übernehmen.",
    href: "/einstellungen/kontenrahmen",
    cta: "Kontenrahmen öffnen",
  },
  {
    key: "paperless",
    titel: "3. Paperless verbinden",
    text: "Paperless-ngx anbinden, damit Belege automatisch importiert werden.",
    href: "/einstellungen/paperless",
    cta: "Paperless verbinden",
  },
  {
    key: "konten",
    titel: "4. Bankkonten anlegen",
    text: "Bank-, PayPal- und Kreditkartenkonten mit Spalten-Mapping anlegen.",
    href: "/einstellungen/konten",
    cta: "Konten anlegen",
  },
  {
    key: "import",
    titel: "5. Kontoauszug importieren",
    text: "Excel/CSV-Kontoauszug hochladen — die Buchungen werden eingelesen.",
    href: "/einstellungen/konten/import",
    cta: "Import starten",
  },
  {
    key: "klassifizierung",
    titel: "6. Klassifizierung starten",
    text: "Der Agent ordnet die Buchungen autonom zu; Ausnahmen landen in der Prüfliste.",
    href: "/buchungen",
    cta: "Zu den Buchungen",
  },
];

export function Onboarding({ status }: { status: OnboardingStatus }) {
  const erledigt = SCHRITTE.filter((s) => status[s.key]).length;
  const gesamt = SCHRITTE.length;
  // Erster nicht erledigter Schritt = der aktuell empfohlene.
  const aktuellerIndex = SCHRITTE.findIndex((s) => !status[s.key]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Willkommen beim STEUERAGENT</CardTitle>
            <Badge variant={erledigt === gesamt ? "default" : "secondary"}>
              {erledigt} / {gesamt} Schritten erledigt
            </Badge>
          </div>
          <CardDescription>
            {erledigt === 0
              ? "Es wurden noch keine Daten erfasst. Richte die folgenden Schritte ein, damit der Agent deine Buchhaltung übernehmen kann."
              : "Richte die noch offenen Schritte ein, damit der Agent deine Buchhaltung vollständig übernehmen kann."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SCHRITTE.map((s, i) => {
              const fertig = status[s.key];
              const aktuell = i === aktuellerIndex;
              return (
                <li
                  key={s.key}
                  className={[
                    "flex flex-col rounded-md border p-4",
                    fertig
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : aktuell
                        ? "border-primary ring-1 ring-primary/30"
                        : "",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2">
                    {fertig ? (
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                        aria-hidden
                      />
                    ) : (
                      <Circle
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    <h3 className="text-sm font-semibold">{s.titel}</h3>
                  </div>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">
                    {s.text}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {fertig ? (
                      <span className="inline-flex items-center text-xs font-medium text-emerald-700">
                        Erledigt
                      </span>
                    ) : null}
                    <Button
                      asChild
                      variant={aktuell ? "default" : "outline"}
                      size="sm"
                      className="ml-auto"
                    >
                      <Link href={s.href}>
                        {fertig ? "Ansehen" : s.cta}
                        {aktuell ? (
                          <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                        ) : null}
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
