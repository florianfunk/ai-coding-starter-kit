// PROJ-4: Bankkonten-API.
// GET  -> Liste aller Konten des Eigentümers (owner-scoped, .limit()).
// POST -> neues Konto anlegen.
// Auth Pflicht (getApiUser). RLS ist zweite Verteidigungslinie.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { kontoInputSchema } from "@/lib/validation/konto";

const SELECT_FELDER = "id, bezeichnung, typ, mapping";

/** GET /api/konten — alle Konten des Eigentümers. */
export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("konto")
    .select(SELECT_FELDER)
    .eq("owner_id", user.id)
    .order("typ", { ascending: true })
    .order("bezeichnung", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: "Konten konnten nicht geladen werden" },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] });
}

/** POST /api/konten — neues Konto anlegen. */
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body" },
      { status: 400 },
    );
  }

  const parsed = kontoInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("konto")
    .insert({
      bezeichnung: parsed.data.bezeichnung,
      typ: parsed.data.typ,
      mapping: parsed.data.mapping ?? null,
      owner_id: user.id,
    })
    .select(SELECT_FELDER)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Konto konnte nicht angelegt werden" },
      { status: 500 },
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
