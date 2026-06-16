// PROJ-8: USt-Voranmeldung (Server Component).
// Lädt das Steuerprofil (Rhythmus/USt-Status) owner-scoped und übergibt es
// an die interaktive Ansicht. Die eigentliche Berechnung läuft serverseitig
// deterministisch über /api/steuer/ust.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UstvaAnsicht } from "@/components/ustva/ustva-ansicht";
import { ustVaPerioden, type UstRhythmus } from "@/lib/tax/perioden";
import type { UstStatus } from "@/lib/types";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { ladeJahrKontext, parseJahrParam } from "@/lib/jahr/aktives-jahr";

export const metadata = {
  title: "USt-Voranmeldung · STEUERAGENT",
};

interface ProfilRow {
  ust_status: UstStatus;
  ust_va_rhythmus: "monatlich" | "quartalsweise" | "jaehrlich";
}

function rhythmusVon(p: ProfilRow): UstRhythmus {
  return p.ust_va_rhythmus === "quartalsweise"
    ? "quartalsweise"
    : p.ust_va_rhythmus === "jaehrlich"
      ? "jaehrlich"
      : "monatlich";
}

export default async function UstVoranmeldungPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const sp = await searchParams;

  const { data: profilData } = await supabase
    .from("firmenprofil")
    .select("ust_status, ust_va_rhythmus")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  const profil = (profilData as ProfilRow | null) ?? null;

  // PROJ-22: Jahr aus explizitem ?jahr= (z. B. Drilldown) > aktivem Jahr >
  // jüngstem Datenjahr > laufendem Kalenderjahr. USt-VA braucht genau ein Jahr,
  // daher bei „Alle Jahre" Fallback auf das jüngste Datenjahr.
  const heute = new Date().getFullYear();
  const explizit = parseJahrParam(typeof sp.jahr === "string" ? sp.jahr : null);
  const { aktivesJahr, verfuegbareJahre } = await ladeJahrKontext(
    supabase,
    user.id,
    heute,
  );
  const jahr = explizit ?? aktivesJahr ?? verfuegbareJahre[0] ?? heute;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Steuer"
        titel="USt-Voranmeldung"
        beschreibung="Belastbarer USt-VA-Vorschlag je Voranmeldungszeitraum. Die Zahlen werden rein rechnerisch aus den klassifizierten Buchungen gebildet (keine KI in der Endsumme). Drill-down zeigt die einbezogenen Buchungen je Kennzahl."
      />

      {!profil ? (
        <Alert variant="destructive">
          <AlertTitle>Kein Steuerprofil</AlertTitle>
          <AlertDescription>
            Bitte zuerst unter „Firma &amp; Steuerprofil“ den USt-Status und
            den Voranmeldungs-Rhythmus pflegen.
          </AlertDescription>
        </Alert>
      ) : (
        <UstvaAnsicht
          rhythmus={rhythmusVon(profil)}
          ustStatus={profil.ust_status}
          jahr={jahr}
          perioden={ustVaPerioden(jahr, rhythmusVon(profil)).map(
            (p) => ({ periode: p.periode, label: p.label }),
          )}
        />
      )}
    </PageShell>
  );
}
