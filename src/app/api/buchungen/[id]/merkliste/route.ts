// PROJ-20: Merkliste-Toggle für eine einzelne Buchung.
// POST /api/buchungen/[id]/merkliste  Body: { action: "add" | "remove" }
//
// Setzt bzw. löscht buchung.gemerkt_am. Auth Pflicht (getApiUser),
// owner-scoped, Zod-validiert. Jede Änderung schreibt einen audit_eintrag
// mit quelle="nutzer".

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { merklisteToggleSchema } from "@/lib/validation/merkliste";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }
  const parsed = merklisteToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen" },
      { status: 422 },
    );
  }
  const { action } = parsed.data;

  const supabase = await createClient();

  // Ownership prüfen (RLS deckt zusätzlich ab).
  const { data: vorher, error: ladeErr } = await supabase
    .from("buchung")
    .select("id, gemerkt_am")
    .eq("owner_id", user.id)
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (ladeErr) {
    return NextResponse.json({ error: "Ladefehler." }, { status: 500 });
  }
  if (!vorher) {
    return NextResponse.json(
      { error: "Buchung nicht gefunden." },
      { status: 404 },
    );
  }

  const gemerkt_am = action === "add" ? new Date().toISOString() : null;

  const { data: nachher, error: updErr } = await supabase
    .from("buchung")
    .update({ gemerkt_am })
    .eq("owner_id", user.id)
    .eq("id", id)
    .select("id, gemerkt_am")
    .single();
  if (updErr) {
    return NextResponse.json(
      { error: "Update fehlgeschlagen: " + updErr.message },
      { status: 500 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    entitaet: "buchung",
    entitaet_id: id,
    aktion: action === "add" ? "gemerkt" : "merken_entfernt",
    quelle: "nutzer",
    details: { gemerkt_am },
  });

  return NextResponse.json({ buchung: nachher });
}
