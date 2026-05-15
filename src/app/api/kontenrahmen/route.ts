import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { kategorieInputSchema } from "@/lib/validation/kontenrahmen";

const SELECT_FELDER =
  "id, bezeichnung, typ, ust_satz, euer_zeile, elster_kennzahl, aktiv, gueltig_ab";

/** GET /api/kontenrahmen — Liste aller Kategorien des Eigentümers. */
export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kategorie")
    .select(SELECT_FELDER)
    .eq("owner_id", user.id)
    .order("typ", { ascending: true })
    .order("bezeichnung", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json(
      { error: "Kategorien konnten nicht geladen werden" },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] });
}

/** POST /api/kontenrahmen — neue Kategorie anlegen. */
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

  const parsed = kategorieInputSchema.safeParse(body);
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
    .from("kategorie")
    .insert({ ...parsed.data, owner_id: user.id })
    .select(SELECT_FELDER)
    .single();

  if (error) {
    // 23505 = unique_violation (owner_id, bezeichnung)
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Eine Kategorie mit dieser Bezeichnung existiert bereits" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Kategorie konnte nicht angelegt werden" },
      { status: 500 },
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
