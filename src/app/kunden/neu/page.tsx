import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { suggestNextKundenNr } from "../actions";
import { KundenStammdatenForm } from "../kunden-stammdaten-form";

export default async function NeuerKundePage() {
  const supabase = await createClient();
  const [{ data: branchen }, kundenNr] = await Promise.all([
    supabase.from("kunden_branchen").select("id, name").order("name"),
    suggestNextKundenNr(),
  ]);

  return (
    <AppShell>
      <PageHeader
        title="Neuer Kunde"
        subtitle="Stammdaten ausfüllen — Auswahl & Preise pflegen wir nach dem Anlegen."
        breadcrumbs={[
          { label: "Kunden", href: "/kunden" },
          { label: "Neu" },
        ]}
      />
      <div className="max-w-3xl">
        <KundenStammdatenForm
          mode="create"
          alleBranchen={branchen ?? []}
          initial={{
            kunden_nr: kundenNr,
            firma: "",
            ansprechpartner: "",
            email: "",
            telefon: "",
            website: "",
            strasse: "",
            plz: "",
            ort: "",
            land: "Deutschland",
            standard_filiale: "",
            notizen: "",
            status: "aktiv",
            branche_ids: [],
          }}
        />
      </div>
    </AppShell>
  );
}
