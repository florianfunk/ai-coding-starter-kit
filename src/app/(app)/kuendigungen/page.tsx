// Kuendigungsliste: alle Empfaenger, die der Nutzer fuer eine Kuendigung
// vorgemerkt hat. Server Component, laedt initial nichts — der Client holt
// sich die Daten via /api/kuendigungen (auch fuer Refresh nach Status-
// Aenderung).

import { requireUser } from "@/lib/auth/guard";
import { KuendigungenListe } from "@/components/kuendigungen/kuendigungen-liste";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

export const metadata = {
  title: "Kuendigungen · STEUERAGENT",
};

export default async function KuendigungenPage() {
  await requireUser();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Heute"
        titel="Kündigungen"
        beschreibung="Empfänger, die du zur Kündigung vorgemerkt hast. Markieren kannst du sie im Abo-Radar (Kategorien-Analyse → Abo-Radar → Gruppe öffnen). Status: offen → gekündigt → beendet."
      />
      <KuendigungenListe />
    </PageShell>
  );
}
