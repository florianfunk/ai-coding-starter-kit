// PROJ-17 — Aktions-Bestaetigen-Endpoint (Confirm-Flow).
//
// POST /api/chat/[konversation_id]/aktion/[aktion_id]/bestaetigen
//
// Validiert Auth + IDs, ruft `fuehreAktionAus()` aus dem Service.
// Service-Funktion ist verantwortlich fuer:
//   - Idempotenz (409 bei bereits confirmed/cancelled)
//   - Lost-Update-Schutz
//   - Audit-Eintrag mit quelle='chat'
//   - Statuswechsel + Bestaetigungs-Nachricht im Chat
//
// Wir reichen nur den HTTP-Status durch, den der Service vorschlaegt.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { fuehreAktionAus } from "@/lib/chat/aktion-ausfuehren";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _req: Request,
  {
    params,
  }: { params: Promise<{ konversation_id: string; aktion_id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { konversation_id, aktion_id } = await params;
  if (!UUID.test(konversation_id) || !UUID.test(aktion_id)) {
    return NextResponse.json({ error: "Ungueltige ID." }, { status: 400 });
  }
  const supabase = await createClient();
  const ergebnis = await fuehreAktionAus(supabase, user.id, aktion_id);
  if (!ergebnis.ok) {
    return NextResponse.json(
      { error: ergebnis.message, code: ergebnis.code },
      { status: ergebnis.status },
    );
  }
  return NextResponse.json({
    ok: true,
    zusammenfassung: ergebnis.zusammenfassung,
    aktualisiert: ergebnis.aktualisiert,
    audit_eintrag_id: ergebnis.audit_eintrag_id,
    ausgefuehrt_am: ergebnis.ausgefuehrt_am,
  });
}
