// PROJ-24: Klassifizierung-Center (Server Component).
// Lädt die Status-Statistik (status × quelle × jahr, owner-scoped, voll
// paginiert) sowie den letzten Lauf und übergibt beides an das Center.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { ladeAlle } from "@/lib/supabase/fetch-all";
import {
  baueKlassifizierungStatistik,
  type StatZeile,
} from "@/lib/klassifizierung/statistik";
import { KlassifizierungCenter } from "@/components/klassifizierung/klassifizierung-center";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import type { JobLauf } from "@/lib/types";

export const metadata = {
  title: "Klassifizierung · STEUERAGENT",
};

const SELECT_JOB =
  "id, art, status, fortschritt, gesamt, ergebnis, fehler_text, created_at";

export default async function KlassifizierungPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: rows } = await ladeAlle((von, bisIdx) =>
    supabase
      .from("buchung")
      .select("status, quelle, buchung_datum")
      .eq("owner_id", user.id)
      .order("id", { ascending: true })
      .range(von, bisIdx),
  );
  const statistik = baueKlassifizierungStatistik((rows ?? []) as StatZeile[]);

  const { data: jobData } = await supabase
    .from("job_lauf")
    .select(SELECT_JOB)
    .eq("owner_id", user.id)
    .eq("art", "klassifizierung")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Bücher"
        titel="Klassifizierung"
        beschreibung="Der Agent ordnet jede Buchung zu (privat/geschäftlich, Steuerrelevanz, EÜR-Kategorie). Lernregeln und deine bestätigten Vorjahres-Entscheidungen haben Vorrang vor der KI. Hier siehst du, wie viele Buchungen schon verarbeitet sind und kannst den Lauf starten."
      />
      <KlassifizierungCenter
        statistik={statistik}
        initialJob={(jobData as JobLauf | null) ?? null}
      />
    </PageShell>
  );
}
