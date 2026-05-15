// PROJ-6: Beleg-Abgleich (Server Component).
// Lädt initiale Fehllisten + Kandidaten owner-scoped und übergibt sie an die
// interaktive Client-Ansicht (Tabs, Re-Matching, manuelle Zuordnung).

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import type { JobLauf, Konto } from "@/lib/types";
import { AbgleichAnsicht } from "@/components/abgleich/abgleich-ansicht";
import type {
  BelegKurz,
  BuchungKurz,
} from "@/components/abgleich/abgleich-typen";

export const metadata = {
  title: "Beleg-Abgleich · STEUERAGENT",
};

export default async function AbgleichPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: kontenData } = await supabase
    .from("konto")
    .select("id, bezeichnung, typ, mapping")
    .eq("owner_id", user.id)
    .order("bezeichnung", { ascending: true })
    .limit(100);
  const konten = (kontenData ?? []) as Konto[];

  const { data: jobData } = await supabase
    .from("job_lauf")
    .select(
      "id, art, status, fortschritt, gesamt, ergebnis, fehler_text, created_at",
    )
    .eq("owner_id", user.id)
    .eq("art", "matching")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const letzterJob = (jobData ?? null) as JobLauf | null;

  // Kandidatenlisten für die manuelle Zuordnung (Command-Suche).
  const { data: belegeData } = await supabase
    .from("beleg")
    .select("id, paperless_id, titel, beleg_datum, korrespondent, betrag, status, quell_link")
    .eq("owner_id", user.id)
    .order("beleg_datum", { ascending: false, nullsFirst: false })
    .limit(2000);
  const alleBelege = (belegeData ?? []) as BelegKurz[];

  const { data: buchungenData } = await supabase
    .from("buchung")
    .select(
      "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation",
    )
    .eq("owner_id", user.id)
    .eq("klassifikation", "geschaeftlich")
    .order("buchung_datum", { ascending: false })
    .limit(2000);
  const alleBuchungen = (buchungenData ?? []) as BuchungKurz[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Beleg-Abgleich
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jede geschäftliche Buchung wird automatisch einem Paperless-Beleg
          zugeordnet (Betrag, Datum, Empfänger, Text). Eindeutige Treffer werden
          verknüpft, unsichere zur Bestätigung gelistet. Manuelle Zuordnungen
          sind vor erneutem Abgleich geschützt.
        </p>
      </div>

      <AbgleichAnsicht
        initialJob={letzterJob}
        konten={konten}
        alleBelege={alleBelege}
        alleBuchungen={alleBuchungen}
      />
    </div>
  );
}
