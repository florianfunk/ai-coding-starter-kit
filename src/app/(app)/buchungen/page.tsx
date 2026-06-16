// PROJ-4/5: Buchungsliste (Server Component).
// Zeigt importierte Buchungen owner-scoped mit Filter nach Konto/Zeitraum.
// Klassifizierungsspalten (Status/Klassifikation) werden angezeigt, falls
// vorhanden — sonst "—" (gefüllt von PROJ-5).

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { aktiverZeitraum } from "@/lib/jahr/aktives-jahr";
import type { Buchung, JobLauf, Kategorie, Konto } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BuchungenLedger } from "@/components/buchungen/buchungen-ledger";
import { KlassifizierungPanel } from "@/components/buchungen/klassifizierung-panel";

export const metadata = {
  title: "Buchungen · STEUERAGENT",
};

const SELECT_FELDER =
  "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund, parent_buchung_id, split_anteil, gemerkt_am";

// Obergrenze der geladenen Buchungen. Such-, Filter- und Summenberechnung
// laufen client-seitig über die geladene Menge — ist diese kleiner als der
// gewählte Zeitraum (alte Grenze: 500), fehlen ältere Buchungen still in Suche
// UND Summen. Großzügig dimensioniert (~2+ Jahre); wird die Grenze erreicht,
// weist der Ledger sichtbar darauf hin.
const MAX_BUCHUNGEN = 5000;

type Such = {
  konto?: string;
  von?: string;
  bis?: string;
};

export default async function BuchungenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const sp = await searchParams;

  const rohFilter: Such = {
    konto: typeof sp.konto === "string" ? sp.konto : undefined,
    von: typeof sp.von === "string" ? sp.von : undefined,
    bis: typeof sp.bis === "string" ? sp.bis : undefined,
  };

  // PROJ-22: Datumsfenster über den globalen Jahreswähler auflösen. Fehlen
  // explizite von/bis (Search-Params), greift das aktive Jahr; gesetzte
  // Grenzen werden darauf geklammert. Das effektive Fenster fließt sowohl in
  // die Server-Query als auch (für die Anzeige der Datums-Inputs) in den an den
  // Ledger gereichten Filter.
  const { von: effVon, bis: effBis } = await aktiverZeitraum(supabase, user.id, {
    von: rohFilter.von ?? null,
    bis: rohFilter.bis ?? null,
    jahr: null,
  });
  const filter: Such = {
    konto: rohFilter.konto,
    von: effVon ?? undefined,
    bis: effBis ?? undefined,
  };

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
    .order("bezeichnung", { ascending: true })
    .limit(500);
  const kategorien = (kategorienData ?? []) as Kategorie[];

  const { data: jobData } = await supabase
    .from("job_lauf")
    .select(
      "id, art, status, fortschritt, gesamt, ergebnis, fehler_text, created_at",
    )
    .eq("owner_id", user.id)
    .eq("art", "klassifizierung")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const letzterJob = (jobData ?? null) as JobLauf | null;

  let query = supabase
    .from("buchung")
    .select(SELECT_FELDER)
    .eq("owner_id", user.id)
    .order("buchung_datum", { ascending: false })
    .limit(MAX_BUCHUNGEN);

  if (filter.konto && filter.konto !== "alle") {
    query = query.eq("konto_id", filter.konto);
  }
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  if (filter.von && isoRe.test(filter.von)) {
    query = query.gte("buchung_datum", filter.von);
  }
  if (filter.bis && isoRe.test(filter.bis)) {
    query = query.lte("buchung_datum", filter.bis);
  }

  const { data, error } = await query;
  // Wurde die Obergrenze erreicht, ist die geladene Menge ggf. unvollständig —
  // der Ledger blendet dann einen Hinweis ein (Suche/Summen unvollständig).
  const abgeschnitten = (data?.length ?? 0) >= MAX_BUCHUNGEN;

  return (
    <div className="space-y-8">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Die Buchungen konnten nicht geladen werden. Bitte lade die Seite
            neu.
          </AlertDescription>
        </Alert>
      ) : (
        <BuchungenLedger
          buchungen={(data ?? []) as Buchung[]}
          konten={konten}
          kategorien={kategorien}
          filter={filter}
          abgeschnitten={abgeschnitten}
          maxBuchungen={MAX_BUCHUNGEN}
        />
      )}

      {/* Klassifizierungs-Panel bleibt unter dem Ledger — wirkt wie ein
          "Tools"-Bereich nach der Hauptansicht. */}
      <KlassifizierungPanel initialJob={letzterJob} />
    </div>
  );
}
