// PROJ-4: Bankkonto bearbeiten/löschen.
// PUT    -> Konto + Mapping-Vorlage aktualisieren.
// DELETE -> Konto löschen (Buchungen werden per ON DELETE CASCADE entfernt).
// Auth Pflicht (getApiUser). Owner-scoped + RLS.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { kontoUpdateSchema } from "@/lib/validation/konto";

const SELECT_FELDER = "id, bezeichnung, typ, mapping";
const idSchema = z.uuid("Ungültige ID");

/** PUT /api/konten/[id] — Konto + Mapping bearbeiten. */
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

  const parsed = kontoUpdateSchema.safeParse(body);
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
    .update({
      bezeichnung: parsed.data.bezeichnung,
      typ: parsed.data.typ,
      mapping: parsed.data.mapping ?? null,
    })
    .eq("id", idCheck.data)
    .eq("owner_id", user.id)
    .select(SELECT_FELDER)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Konto nicht gefunden" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Konto konnte nicht aktualisiert werden" },
      { status: 500 },
    );
  }

  return NextResponse.json({ data });
}

/**
 * DELETE /api/konten/[id] — Konto löschen.
 * Achtung: dem Konto zugeordnete Buchungen werden per
 * ON DELETE CASCADE mitgelöscht.
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
    .from("konto")
    .delete()
    .eq("id", idCheck.data)
    .eq("owner_id", user.id)
    .select(SELECT_FELDER)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Konto nicht gefunden" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Konto konnte nicht gelöscht werden" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data,
    message: "Konto und zugehörige Buchungen gelöscht",
  });
}
