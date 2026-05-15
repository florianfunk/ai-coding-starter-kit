// PROJ-7: Prüfliste (Server Component).
// Lädt alle offenen Ausnahmen (Buchungen mit status='zur_pruefung') des
// Eigentümers samt Konten/Kategorien für die Schnellentscheidung.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import type { Buchung, Kategorie, Konto } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PrueflisteAnsicht } from "@/components/pruefliste/pruefliste-ansicht";

export const metadata = {
  title: "Prüfliste · STEUERAGENT",
};

const SELECT_FELDER =
  "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund, parent_buchung_id, split_anteil";

export default async function PrueflistePage() {
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

  const { data, error } = await supabase
    .from("buchung")
    .select(SELECT_FELDER)
    .eq("owner_id", user.id)
    .eq("status", "zur_pruefung")
    .order("buchung_datum", { ascending: false })
    .limit(1000);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prüfliste</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nur die Fälle, die der Agent nicht sicher entscheiden konnte.
          Entscheide schnell – optional als Lernregel speichern, damit
          gleichartige Buchungen künftig automatisch laufen.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Die Prüfliste konnte nicht geladen werden. Bitte lade die Seite
            neu.
          </AlertDescription>
        </Alert>
      ) : (
        <PrueflisteAnsicht
          initialFaelle={(data ?? []) as Buchung[]}
          konten={konten}
          kategorien={kategorien}
        />
      )}
    </div>
  );
}
