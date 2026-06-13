// Undo eines Konto-Imports.
//
// DELETE /api/importe/[id] loescht alle Buchungen, die ueber
// `import_lauf_id` mit dem angegebenen job_lauf verknuepft sind, und
// markiert den Lauf als 'fehler' mit dem Text "rueckgaengig". Manuell
// bestaetigte Buchungen werden bewusst MIT geloescht — der Nutzer hat
// das so gewaehlt: ein Undo macht den Import komplett rueckgaengig,
// unabhaengig vom Bearbeitungs-Status.
//
// Cascade-Effekte (greifen automatisch ueber Foreign Keys mit ON DELETE
// CASCADE):
//   - beleg_buchung-Verknuepfungen werden mitgeloescht
//   - Split-Children (parent_buchung_id) werden mitgeloescht
// Belege (aus Paperless) und Lernregeln bleiben unangetastet.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Ungueltige ID." }, { status: 400 });
  }

  const supabase = await createClient();

  // Lauf laden + Ownership pruefen.
  const { data: lauf, error: ladeErr } = await supabase
    .from("job_lauf")
    .select("id, art, dateiname")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (ladeErr) {
    return NextResponse.json({ error: "Ladefehler." }, { status: 500 });
  }
  if (!lauf) {
    return NextResponse.json(
      { error: "Import-Lauf nicht gefunden." },
      { status: 404 },
    );
  }
  if (lauf.art !== "konto_import") {
    return NextResponse.json(
      { error: "Dieser Lauf ist kein Konto-Import." },
      { status: 422 },
    );
  }

  // Buchungen aus diesem Lauf zaehlen + loeschen.
  const { error: delErr, count } = await supabase
    .from("buchung")
    .delete({ count: "exact" })
    .eq("owner_id", user.id)
    .eq("import_lauf_id", id);
  if (delErr) {
    return NextResponse.json(
      { error: "Loeschen fehlgeschlagen: " + delErr.message },
      { status: 500 },
    );
  }

  // Lauf-Status auf "fehler" setzen mit Hinweistext, damit die Historie
  // sichtbar bleibt (zum Nachvollziehen). Alternative waere job_lauf
  // selbst zu loeschen — dann waere die Datei-Kenntnis verloren.
  await supabase
    .from("job_lauf")
    .update({
      status: "fehler",
      fehler_text: `Rueckgaengig gemacht (${count ?? 0} Buchungen geloescht).`,
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  // Audit-Eintrag fuer die Rueckabwicklung.
  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    entitaet: "job_lauf",
    entitaet_id: id,
    aktion: "import_rueckgaengig",
    quelle: "nutzer",
    details: {
      dateiname: lauf.dateiname,
      geloeschte_buchungen: count ?? 0,
    },
  });

  return NextResponse.json({
    geloescht: count ?? 0,
    dateiname: lauf.dateiname,
  });
}
