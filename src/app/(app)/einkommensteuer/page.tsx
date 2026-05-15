// PROJ-10: Einkommensteuer-Vorschau & Privatentnahmen (Server Component).
//
// Ermittelt den Jahres-Auswahlbereich aus dem Buchungsbestand (analog zur
// Jahres-EÜR). Die eigentliche Schätzung + Privatentnahmen-Aufstellung holt
// die Client-Ansicht deterministisch über /api/steuer/est.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { EstAnsicht } from "@/components/est/est-ansicht";

export const metadata = {
  title: "Einkommensteuer · STEUERAGENT",
};

export default async function EinkommensteuerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const sp = await searchParams;

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
          Einkommensteuer-Vorschau &amp; Privatentnahmen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Grobe ESt-Schätzung auf Basis des EÜR-Gewinns (deterministisch,
          §32a EStG) sowie die vollständige Aufstellung aller privaten
          Entnahmen. Beides reproduzierbar je Jahr mit Drill-down. Die
          Schätzung ist ausdrücklich unverbindlich.
        </p>
      </div>

      <EstAnsicht jahre={jahre} jahrInitial={vorgewaehlt} />
    </div>
  );
}
