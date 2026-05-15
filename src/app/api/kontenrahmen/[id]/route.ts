import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { kategorieUpdateSchema } from "@/lib/validation/kontenrahmen";

const SELECT_FELDER =
  "id, bezeichnung, typ, ust_satz, euer_zeile, elster_kennzahl, aktiv, gueltig_ab";

const idSchema = z.uuid("Ungültige ID");

/** PUT /api/kontenrahmen/[id] — Kategorie bearbeiten. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { id } = await params;
  const idCheck = idSchema.safeParse(id);
  if (!idCheck.success) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
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

  const parsed = kategorieUpdateSchema.safeParse(body);
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
    .update(parsed.data)
    .eq("id", idCheck.data)
    .eq("owner_id", user.id)
    .select(SELECT_FELDER)
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Eine Kategorie mit dieser Bezeichnung existiert bereits" },
        { status: 409 },
      );
    }
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Kategorie nicht gefunden" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Kategorie konnte nicht aktualisiert werden" },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
}

/**
 * DELETE /api/kontenrahmen/[id] — KEIN Hard-Delete.
 * Im MVP wird ausschließlich soft-deaktiviert (aktiv = false), damit
 * historische Buchungen weiterhin auf die Kategorie verweisen können.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { id } = await params;
  const idCheck = idSchema.safeParse(id);
  if (!idCheck.success) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kategorie")
    .update({ aktiv: false })
    .eq("id", idCheck.data)
    .eq("owner_id", user.id)
    .select(SELECT_FELDER)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Kategorie nicht gefunden" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Kategorie konnte nicht deaktiviert werden" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data,
    message: "Kategorie deaktiviert (historisch erhalten, nicht gelöscht)",
  });
}
