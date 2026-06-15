// PROJ-21: Lieferanten-Notizen — Übersicht (Server Component).
// Lädt alle Notizen des Eigentümers, leitet Anzeigenamen aus den Buchungen
// ab (häufigste Roh-Schreibweise je normalisiertem Empfänger) und gruppiert
// sie je Lieferant (jüngste Notiz/Gruppe zuerst).

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { ladeAlle } from "@/lib/supabase/fetch-all";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { LieferantenNotizenAnsicht } from "@/components/lieferanten-notizen/lieferanten-notizen-ansicht";
import {
  gruppiereNotizen,
  type LieferantNotizRow,
} from "@/lib/finanzen/lieferant-notizen";

export const metadata = {
  title: "Lieferanten-Notizen · STEUERAGENT",
};

export default async function LieferantenNotizenPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lieferant_notiz")
    .select(
      "id, empfaenger_norm, rohwert_beispiel, inhalt, erstellt_am, aktualisiert_am",
    )
    .eq("owner_id", user.id)
    .order("aktualisiert_am", { ascending: false })
    .limit(2000);

  const rows = (data ?? []) as LieferantNotizRow[];

  // Anzeigenamen aus Buchungen ableiten (häufigste Roh-Schreibweise je norm).
  const normWerte = Array.from(new Set(rows.map((r) => r.empfaenger_norm)));
  const anzeigeNamen = new Map<string, string>();
  if (normWerte.length > 0) {
    const { data: buchungen } = await ladeAlle((von, bis) =>
      supabase
        .from("buchung")
        .select("empfaenger_normalisiert, empfaenger")
        .eq("owner_id", user.id)
        .in("empfaenger_normalisiert", normWerte)
        .order("id", { ascending: true })
        .range(von, bis),
    );
    const haeufigkeit = new Map<string, Map<string, number>>();
    for (const b of (buchungen ?? []) as Array<{
      empfaenger_normalisiert: string | null;
      empfaenger: string | null;
    }>) {
      const norm = (b.empfaenger_normalisiert ?? "").trim();
      const roh = (b.empfaenger ?? "").trim();
      if (!norm || !roh) continue;
      const zaehler = haeufigkeit.get(norm) ?? new Map<string, number>();
      zaehler.set(roh, (zaehler.get(roh) ?? 0) + 1);
      haeufigkeit.set(norm, zaehler);
    }
    for (const [norm, zaehler] of haeufigkeit) {
      let bestName = "";
      let bestAnzahl = 0;
      for (const [name, anzahl] of zaehler) {
        if (anzahl > bestAnzahl) {
          bestAnzahl = anzahl;
          bestName = name;
        }
      }
      if (bestName) anzeigeNamen.set(norm, bestName);
    }
  }

  const gruppen = gruppiereNotizen(rows, anzeigeNamen);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Heute"
        titel="Lieferanten-Notizen"
        beschreibung="Deine Notizen pro Lieferant — festgehalten, zu welcher Software, Lizenz oder Abbuchung die Buchungen eines Empfängers gehören. Bearbeite oder ergänze sie hier oder direkt im Lieferanten-Tab."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Die Lieferanten-Notizen konnten nicht geladen werden. Bitte lade
            die Seite neu.
          </AlertDescription>
        </Alert>
      ) : (
        <LieferantenNotizenAnsicht initialGruppen={gruppen} />
      )}
    </PageShell>
  );
}
