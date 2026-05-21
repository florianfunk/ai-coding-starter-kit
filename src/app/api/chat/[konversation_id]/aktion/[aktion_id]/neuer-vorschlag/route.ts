// PROJ-17 — "Neuen Vorschlag generieren"-Endpoint.
//
// POST /api/chat/[konversation_id]/aktion/[aktion_id]/neuer-vorschlag
//
// Wird vom UI aufgerufen, wenn der Nutzer auf einem fehlgeschlagenen
// Aktions-Vorschlag (status='error') auf "Neuen Vorschlag generieren" klickt.
//
// Idempotenz-/Sicherheits-Eigenschaften:
//   - Der alte Vorschlag bleibt unveraendert (status='error') — Audit-Spur
//     bleibt erhalten.
//   - Ein neuer chat_aktion-Eintrag wird mit identischen Parametern + neuer
//     ID + status='pending_confirm' angelegt.
//   - Eine neue Assistant-Nachricht wird in den Chat geschrieben, die auf den
//     neuen Vorschlag verweist.
//   - Lost-Update-Recheck: vor der Anlage wird geprueft, ob die ursprueng-
//     lichen Voraussetzungen (Buchungen existieren, nicht manuell_bestaetigt,
//     Ziel-Kategorie vorhanden, …) heute noch erfuellt sind. Wenn nicht →
//     409 statt toter Vorschlag.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { legeNeuenVorschlagAn } from "@/lib/chat/aktion-ausfuehren";

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
  const ergebnis = await legeNeuenVorschlagAn(supabase, user.id, aktion_id);
  if (!ergebnis.ok) {
    return NextResponse.json(
      { error: ergebnis.message, code: ergebnis.code },
      { status: ergebnis.status },
    );
  }
  return NextResponse.json({
    ok: true,
    neue_aktion_id: ergebnis.neue_aktion_id,
    neue_nachricht_id: ergebnis.neue_nachricht_id,
  });
}
