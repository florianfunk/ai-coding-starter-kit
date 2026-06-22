// PROJ-15 P2 (#3): "Häufige Prüflisten-Empfänger" — Kandidatenliste für neue
// Lernregeln.
//
// GET -> aggregiert die offenen Prüffälle (status='zur_pruefung') des Eigentümers
//        gruppiert nach `empfaenger_normalisiert`: Anzahl, Beispiel-Rohwert,
//        Summe/Durchschnitt der Absolutbeträge, jüngstes Datum und die distinct
//        Prüf-Gründe. Sortiert nach Häufigkeit. So sieht der Inhaber sofort, für
//        welche wiederkehrenden Empfänger sich eine Regel am meisten lohnt.
//
//        Query-Parameter (optional):
//          - min_anzahl: nur Gruppen mit ≥ N Treffern (Default 2 — Einzelfälle
//            taugen selten als Regel-Kandidat).
//          - limit: Obergrenze der Ergebnisliste (Default 100, max 500).
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS.
// PROJ-22: respektiert das global aktive Jahr (firmenprofil.aktives_jahr).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { aktiverZeitraum } from "@/lib/jahr/aktives-jahr";
import { ladeAlle } from "@/lib/supabase/fetch-all";
import {
  aggregiereHaeufigeEmpfaenger,
  type PrueflistenZeile,
  type HaeufigerEmpfaenger,
} from "@/lib/klassifizierung/haeufige-empfaenger";

export const runtime = "nodejs";

const SELECT_FELDER =
  "empfaenger_normalisiert, empfaenger, betrag, buchung_datum, pruef_grund";

const querySchema = z.object({
  min_anzahl: z.coerce.number().int().min(1).max(1000).optional().default(2),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

export interface HaeufigeEmpfaengerResponse {
  data: HaeufigerEmpfaenger[];
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    min_anzahl: url.searchParams.get("min_anzahl") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Parameter." },
      { status: 422 },
    );
  }
  const { min_anzahl, limit } = parsed.data;

  const supabase = await createClient();

  // PROJ-22: auf das global aktive Jahr scopen (mirror kuendigungen/pruefliste).
  const { von, bis } = await aktiverZeitraum(supabase, user.id, {});

  // Vollständig paginiert laden — PostgREST deckelt sonst bei 1000 Zeilen und
  // schneidet (asc-Sortierung) jüngere Prüffälle ab. Stabile Sortierung via id.
  const { data, error } = await ladeAlle((vonIdx, bisIdx) => {
    let q = supabase
      .from("buchung")
      .select(SELECT_FELDER)
      .eq("owner_id", user.id)
      .eq("status", "zur_pruefung")
      .order("buchung_datum", { ascending: true })
      .order("id", { ascending: true })
      .range(vonIdx, bisIdx);
    if (von) q = q.gte("buchung_datum", von);
    if (bis) q = q.lte("buchung_datum", bis);
    return q;
  });
  if (error) {
    return NextResponse.json(
      { error: "Prüflisten-Empfänger konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  const zeilen = (data ?? []) as PrueflistenZeile[];
  const aggregat = aggregiereHaeufigeEmpfaenger(zeilen, { min_anzahl, limit });

  return NextResponse.json({
    data: aggregat,
  } satisfies HaeufigeEmpfaengerResponse);
}
