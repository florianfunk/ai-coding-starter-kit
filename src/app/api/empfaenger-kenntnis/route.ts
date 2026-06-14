// PROJ-15: Empfänger-Wissen zu einer Buchung — macht die Web-Recherche
// nachvollziehbar. Liefert das im Klassifizierungs-Cache hinterlegte Wissen
// (Branche, Leistung, Web-Snippets, Quelle) zum normalisierten Empfänger der
// Buchung. So sieht der Nutzer im Detail-Sheet, WAS recherchiert wurde und
// WARUM die Kategorie so gesetzt ist.
//
// GET /api/empfaenger-kenntnis?buchung_id=<uuid>
//   → { kenntnis: EmpfaengerKenntnis | null }
//
// Auth Pflicht; owner-scoped (RLS + explizit).

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { holeKenntnis } from "@/lib/classifier/empfaenger-cache";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const buchungId = new URL(request.url).searchParams.get("buchung_id");
  if (!buchungId) {
    return NextResponse.json(
      { error: "buchung_id fehlt." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Normalisierten Empfänger der Buchung laden (owner-scoped).
  const { data: b, error } = await supabase
    .from("buchung")
    .select("empfaenger_normalisiert")
    .eq("owner_id", user.id)
    .eq("id", buchungId)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: "Buchung konnte nicht geladen werden." },
      { status: 500 },
    );
  }

  const norm = (b?.empfaenger_normalisiert ?? "").trim();
  if (!norm) {
    return NextResponse.json({ kenntnis: null });
  }

  const kenntnis = await holeKenntnis(supabase, user.id, norm);
  return NextResponse.json({ kenntnis });
}
