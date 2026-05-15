// PROJ-12: Komposition aller Dashboard-Kacheln zu einem responsiven Grid.
// Server-renderbar (rein darstellend, alle Daten kommen vorgeladen herein).

import type { DashboardAggregat } from "@/lib/dashboard/aggregate";
import { AktionsKachel } from "./aktions-kachel";
import { SyncKachel } from "./sync-kachel";
import { KennzahlenKachel } from "./kennzahlen-kachel";
import { PeriodenUebersicht } from "./perioden-uebersicht";

export function DashboardGrid({ data }: { data: DashboardAggregat }) {
  return (
    <div className="space-y-6">
      <section
        aria-label="Aktions-Kacheln"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <AktionsKachel
          titel="Offene Prüffälle"
          beschreibung="Buchungen, die der Agent nicht sicher zuordnen konnte."
          anzahl={data.aktionen.offene_prueffaelle}
          href="/pruefliste"
          cta="Zur Prüfliste"
          tonAlarm
        />
        <AktionsKachel
          titel="Fehlende Belege"
          beschreibung="Geschäftliche Buchungen ohne zugeordneten Beleg."
          anzahl={data.aktionen.fehlende_belege}
          href="/abgleich"
          cta="Zum Beleg-Abgleich"
          tonAlarm
        />
        <AktionsKachel
          titel="Unklassifizierte Buchungen"
          beschreibung="Noch nicht klassifizierte (offene) Buchungen."
          anzahl={data.aktionen.unklassifiziert}
          href="/buchungen"
          cta="Zu den Buchungen"
        />
        <SyncKachel
          titel="Letzter Paperless-Sync"
          beschreibung="Belegimport aus Paperless-ngx."
          status={data.paperless_sync}
          href="/einstellungen/paperless"
          cta="Paperless-Einstellungen"
        />
        <SyncKachel
          titel="Letzter Kontoimport"
          beschreibung="Import von Kontoauszügen (Excel/CSV)."
          status={data.konto_import}
          href="/einstellungen/konten"
          cta="Bankkonten & Import"
        />
        <KennzahlenKachel jahr={data.jahr} />
      </section>

      <PeriodenUebersicht perioden={data.perioden} />
    </div>
  );
}
