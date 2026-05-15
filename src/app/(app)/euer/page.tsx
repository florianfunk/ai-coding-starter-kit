// PROJ-9: Jahres-EÜR (§4 Abs.3 EStG) — Seite (Server Component).
//
// Lädt das Wirtschaftsjahr-Beginn-Profil und die Liste vorhandener
// Buchungsjahre für die Auswahl. Die eigentliche EÜR (Berechnung/Snapshot,
// Warnungen, Abschluss) holt die Client-Komponente über /api/steuer/euer.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { EuerAnsicht } from "@/components/euer/euer-ansicht";

export const metadata = {
  title: "Jahres-EÜR · STEUERAGENT",
};

export default async function EuerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const sp = await searchParams;

  // Wirtschaftsjahr-Beginn (für die Jahres-Label-Hinweise).
  const { data: profil } = await supabase
    .from("firmenprofil")
    .select("wirtschaftsjahr_beginn")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  const wjBeginn =
    (profil as { wirtschaftsjahr_beginn?: number } | null)
      ?.wirtschaftsjahr_beginn ?? 1;

  // Frühestes/spätestes Buchungsdatum → Auswahlbereich der Jahre.
  const { data: minRow } = await supabase
    .from("buchung")
    .select("buchung_datum")
    .eq("owner_id", user.id)
    .order("buchung_datum", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: maxRow } = await supabase
    .from("buchung")
    .select("buchung_datum")
    .eq("owner_id", user.id)
    .order("buchung_datum", { ascending: false })
    .limit(1)
    .maybeSingle();

  const heute = new Date().getFullYear();
  const minJahr = minRow
    ? Number((minRow as { buchung_datum: string }).buchung_datum.slice(0, 4))
    : heute;
  const maxJahr = maxRow
    ? Number((maxRow as { buchung_datum: string }).buchung_datum.slice(0, 4))
    : heute;

  const jahre: number[] = [];
  for (let j = Math.max(maxJahr, heute); j >= Math.min(minJahr, heute); j--) {
    jahre.push(j);
  }

  const vorgewaehlt =
    typeof sp.jahr === "string" && /^\d{4}$/.test(sp.jahr)
      ? Number(sp.jahr)
      : (jahre[0] ?? heute);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Jahres-EÜR (§4 Abs.3 EStG)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Betriebseinnahmen minus Betriebsausgaben je EÜR-Kategorie nach
          striktem Zufluss-/Abflussprinzip. Deterministisch berechnet, keine
          KI in den Summen. Klicke eine Position für den Drill-down auf die
          einzelnen Buchungen.
        </p>
      </div>

      <EuerAnsicht
        jahre={jahre}
        jahrInitial={vorgewaehlt}
        wjBeginn={wjBeginn}
      />
    </div>
  );
}
