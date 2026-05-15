// PROJ-4/5: Buchungsliste (Server Component).
// Zeigt importierte Buchungen owner-scoped mit Filter nach Konto/Zeitraum.
// Klassifizierungsspalten (Status/Klassifikation) werden angezeigt, falls
// vorhanden — sonst "—" (gefüllt von PROJ-5).

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import type { Buchung, Konto } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BuchungenAnsicht } from "@/components/buchungen/buchungen-ansicht";

export const metadata = {
  title: "Buchungen · STEUERAGENT",
};

const SELECT_FELDER =
  "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund, parent_buchung_id, split_anteil";

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

  const filter: Such = {
    konto: typeof sp.konto === "string" ? sp.konto : undefined,
    von: typeof sp.von === "string" ? sp.von : undefined,
    bis: typeof sp.bis === "string" ? sp.bis : undefined,
  };

  const { data: kontenData } = await supabase
    .from("konto")
    .select("id, bezeichnung, typ, mapping")
    .eq("owner_id", user.id)
    .order("bezeichnung", { ascending: true })
    .limit(100);
  const konten = (kontenData ?? []) as Konto[];

  let query = supabase
    .from("buchung")
    .select(SELECT_FELDER)
    .eq("owner_id", user.id)
    .order("buchung_datum", { ascending: false })
    .limit(500);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Buchungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle importierten Kontobewegungen. Die Klassifizierung (Kategorie,
          privat/geschäftlich, Status) erfolgt in einem späteren Schritt.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Fehler beim Laden</AlertTitle>
          <AlertDescription>
            Die Buchungen konnten nicht geladen werden. Bitte lade die Seite
            neu.
          </AlertDescription>
        </Alert>
      ) : (
        <BuchungenAnsicht
          buchungen={(data ?? []) as Buchung[]}
          konten={konten}
          filter={filter}
        />
      )}
    </div>
  );
}
