// PROJ-6: Manuelle Beleg<->Buchung-Zuordnung.
//
// POST   -> manuelle Zuordnung anlegen ODER unsicheren Vorschlag bestätigen.
//           Ergebnis: status='manuell', gesperrt=true (vor Re-Match geschützt).
//           aktion='verwerfen' löscht einen unsicheren Vorschlag.
// DELETE  -> Zuordnung aufheben (per id). Auch gesperrte dürfen manuell
//            aufgehoben werden (bewusste Nutzeraktion).
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS. Zod vor DB.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  zuordnungAnlegenSchema,
  zuordnungLoeschenSchema,
} from "@/lib/matching/validation";

export const runtime = "nodejs";

const SELECT_FELDER =
  "id, beleg_id, buchung_id, match_score, kriterien, status, gesperrt, created_at";

/** POST — manuelle Zuordnung anlegen / unsicheren Match bestätigen/verwerfen. */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 },
    );
  }
  const parsed = zuordnungAnlegenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const { beleg_id, buchung_id, aktion } = parsed.data;

  const supabase = await createClient();

  // Beleg + Buchung müssen dem Nutzer gehören (Defense-in-Depth zu RLS).
  const [{ data: beleg }, { data: buchung }] = await Promise.all([
    supabase
      .from("beleg")
      .select("id")
      .eq("owner_id", user.id)
      .eq("id", beleg_id)
      .maybeSingle(),
    supabase
      .from("buchung")
      .select("id")
      .eq("owner_id", user.id)
      .eq("id", buchung_id)
      .maybeSingle(),
  ]);
  if (!beleg || !buchung) {
    return NextResponse.json(
      { error: "Beleg oder Buchung nicht gefunden." },
      { status: 404 },
    );
  }

  if (aktion === "verwerfen") {
    const { error } = await supabase
      .from("beleg_buchung")
      .delete()
      .eq("owner_id", user.id)
      .eq("beleg_id", beleg_id)
      .eq("buchung_id", buchung_id)
      .eq("gesperrt", false); // gesperrte werden nicht „verworfen"
    if (error) {
      return NextResponse.json(
        { error: "Zuordnung konnte nicht verworfen werden." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  // Anlegen oder bestätigen: manuell + gesperrt (überlebt Re-Matching).
  const { data, error } = await supabase
    .from("beleg_buchung")
    .upsert(
      {
        owner_id: user.id,
        beleg_id,
        buchung_id,
        status: "manuell",
        gesperrt: true,
      },
      { onConflict: "owner_id,beleg_id,buchung_id", ignoreDuplicates: false },
    )
    .select(SELECT_FELDER)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Zuordnung konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
  return NextResponse.json({ data }, { status: 201 });
}

/** DELETE — Zuordnung aufheben (per id; auch gesperrte als Nutzeraktion). */
export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 },
    );
  }
  const parsed = zuordnungLoeschenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("beleg_buchung")
    .delete()
    .eq("owner_id", user.id)
    .eq("id", parsed.data.id);

  if (error) {
    return NextResponse.json(
      { error: "Zuordnung konnte nicht aufgehoben werden." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
