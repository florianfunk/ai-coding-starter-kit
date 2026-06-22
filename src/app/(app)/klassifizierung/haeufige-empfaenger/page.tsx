// PROJ-15 P2 (#3): "Häufige Prüflisten-Empfänger" (Server Component).
// Lädt Konten/Kategorien für den Regel-Dialog; die Empfänger-Aggregate werden
// client-seitig über GET /api/pruefliste/haeufige-empfaenger geladen (Jahres-
// gescoped serverseitig). So ist die Seite eine eigenständige Kandidatenliste
// für neue Lernregeln, ohne in den Stammdaten-/Admin-Bereich zu greifen.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import type { Kategorie, Konto } from "@/lib/types";
import { HaeufigeEmpfaengerListe } from "@/components/klassifizierung/haeufige-empfaenger-liste";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

export const metadata = {
  title: "Häufige Prüflisten-Empfänger · STEUERAGENT",
};

export default async function HaeufigeEmpfaengerPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: kontenData } = await supabase
    .from("konto")
    .select("id, bezeichnung, typ, mapping")
    .eq("owner_id", user.id)
    .order("bezeichnung", { ascending: true })
    .limit(100);
  const konten = (kontenData ?? []) as Konto[];

  const { data: kategorienData } = await supabase
    .from("kategorie")
    .select(
      "id, bezeichnung, typ, ust_satz, euer_zeile, elster_kennzahl, aktiv, gueltig_ab",
    )
    .eq("owner_id", user.id)
    .eq("aktiv", true)
    .order("bezeichnung", { ascending: true })
    .limit(500);
  const kategorien = (kategorienData ?? []) as Kategorie[];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Bücher"
        titel="Häufige Prüflisten-Empfänger"
        beschreibung="Wiederkehrende Empfänger, die immer wieder zur Prüfung landen — sortiert nach Häufigkeit. Lege aus einem Kandidaten direkt eine Lernregel an, damit gleichartige Buchungen künftig automatisch klassifiziert werden."
      />
      <HaeufigeEmpfaengerListe konten={konten} kategorien={kategorien} />
    </PageShell>
  );
}
