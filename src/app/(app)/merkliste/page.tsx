// PROJ-20: Merkliste (Server Component).
// Lädt alle gemerkten Buchungen (gemerkt_am IS NOT NULL) des Eigentümers,
// sortiert nach Merk-Zeitpunkt (zuletzt gemerkte oben), samt Konten/Kategorien
// für das Detail-Sheet.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { aktiverZeitraum } from "@/lib/jahr/aktives-jahr";
import type { Buchung, Kategorie, Konto } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MerklisteAnsicht } from "@/components/merkliste/merkliste-ansicht";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

export const metadata = {
  title: "Merkliste · STEUERAGENT",
};

const SELECT_FELDER =
  "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund, parent_buchung_id, split_anteil, gemerkt_am";

export default async function MerklistePage() {
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
    .order("bezeichnung", { ascending: true })
    .limit(500);
  const kategorien = (kategorienData ?? []) as Kategorie[];

  // PROJ-22: Merkliste aufs global aktive Jahr scopen.
  const { von, bis } = await aktiverZeitraum(supabase, user.id, {});

  let buchungenQuery = supabase
    .from("buchung")
    .select(SELECT_FELDER)
    .eq("owner_id", user.id)
    .not("gemerkt_am", "is", null)
    .order("gemerkt_am", { ascending: false })
    .limit(1000);
  if (von) buchungenQuery = buchungenQuery.gte("buchung_datum", von);
  if (bis) buchungenQuery = buchungenQuery.lte("buchung_datum", bis);

  const { data, error } = await buchungenQuery;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Heute"
        titel="Merkliste"
        beschreibung="Buchungen, die du zum späteren Prüfen gemerkt hast. Tippe eine Zeile für die Details oder recherchiere in Ruhe — entferne den Stern, wenn der Fall geklärt ist."
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Die Merkliste konnte nicht geladen werden. Bitte lade die Seite neu.
          </AlertDescription>
        </Alert>
      ) : (
        <MerklisteAnsicht
          initialBuchungen={(data ?? []) as Buchung[]}
          konten={konten}
          kategorien={kategorien}
        />
      )}
    </PageShell>
  );
}
