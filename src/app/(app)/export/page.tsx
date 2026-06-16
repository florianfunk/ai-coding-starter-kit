// PROJ-11: Export-Seite (Server Component).
//
// Lädt das Firmenprofil (Rhythmus für USt-VA-Perioden) sowie den
// auswählbaren Jahresbereich (aus den Buchungsdaten) und übergibt sie an
// die interaktive Auswahl. Erzeugung/Download laufen serverseitig über
// /api/export (Snapshot bei abgeschlossenen Perioden).

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExportAuswahl } from "@/components/export/export-auswahl";
import { ustVaPerioden, type UstRhythmus } from "@/lib/tax/perioden";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { ladeAktivesJahr } from "@/lib/jahr/aktives-jahr";

export const metadata = {
  title: "Export · STEUERAGENT",
};

interface ProfilRow {
  ust_va_rhythmus: "monatlich" | "quartalsweise" | "jaehrlich";
}

function rhythmusVon(p: ProfilRow): UstRhythmus {
  return p.ust_va_rhythmus === "quartalsweise"
    ? "quartalsweise"
    : p.ust_va_rhythmus === "jaehrlich"
      ? "jaehrlich"
      : "monatlich";
}

export default async function ExportPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profilData } = await supabase
    .from("firmenprofil")
    .select("ust_va_rhythmus")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  const profil = (profilData as ProfilRow | null) ?? null;

  // Auswählbarer Jahresbereich aus den vorhandenen Buchungen.
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

  // PROJ-22: aktives Jahr als Vorauswahl (falls im Bereich).
  const aktivesJahr = await ladeAktivesJahr(supabase, user.id);
  const vorgewaehlt =
    aktivesJahr != null && jahre.includes(aktivesJahr)
      ? aktivesJahr
      : (jahre[0] ?? heute);

  const rhy: UstRhythmus = profil ? rhythmusVon(profil) : "monatlich";
  // Perioden je auswählbarem Jahr (für USt-VA/ELSTER).
  const periodenProJahr: Record<
    number,
    Array<{ periode: number; label: string }>
  > = {};
  for (const j of jahre) {
    periodenProJahr[j] = ustVaPerioden(j, rhy).map((p) => ({
      periode: p.periode,
      label: p.label,
    }));
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Steuer"
        titel="Export"
        beschreibung="EÜR, USt-VA, Privatentnahmen, Buchungssätze (CSV/DATEV-ähnlich) und ELSTER-Kennzahlen exportieren. Abgeschlossene Perioden nutzen den unveränderlichen Snapshot; offene Zeiträume werden deutlich als „vorläufig“ gekennzeichnet."
      />

      {!profil ? (
        <Alert variant="destructive">
          <AlertTitle>Kein Firmenprofil</AlertTitle>
          <AlertDescription>
            Bitte zuerst unter „Firma &amp; Steuerprofil“ die Stammdaten
            pflegen — sie erscheinen im Kopf jeder exportierten Datei.
          </AlertDescription>
        </Alert>
      ) : (
        <ExportAuswahl
          key={vorgewaehlt}
          jahre={jahre}
          rhythmus={rhy}
          periodenProJahr={periodenProJahr}
          jahrInitial={vorgewaehlt}
        />
      )}
    </PageShell>
  );
}
