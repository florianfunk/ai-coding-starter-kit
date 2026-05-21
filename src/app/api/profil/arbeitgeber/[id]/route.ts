// PROJ-16: Arbeitgeber-Eintrag bearbeiten / loeschen.
//
// PATCH  -> Teilmenge der Felder, `name_normalisiert` wird bei `name`-
//           Aenderung neu berechnet.
// DELETE -> hartes Loeschen.
//
// Audit-Eintrag pro Mutation. RLS + owner-scoped als zweite Verteidigung.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { arbeitgeberUpdateSchema } from "@/lib/validation/profil";
import { normalisiereProfilName } from "@/lib/classifier/profil";

const SELECT_FELDER =
  "id, name, name_normalisiert, aktiv_von, aktiv_bis, notiz, updated_at";

const idSchema = z.uuid("Ungültige ID");

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;
  const idCheck = idSchema.safeParse(id);
  if (!idCheck.success) {
    return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
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

  const parsed = arbeitgeberUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name;
    updates.name_normalisiert = normalisiereProfilName(parsed.data.name);
  }
  if (parsed.data.aktiv_von !== undefined) {
    updates.aktiv_von = parsed.data.aktiv_von;
  }
  if (parsed.data.aktiv_bis !== undefined) {
    updates.aktiv_bis = parsed.data.aktiv_bis;
  }
  if (parsed.data.notiz !== undefined) {
    updates.notiz = parsed.data.notiz;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Keine Aenderungen uebergeben." },
      { status: 422 },
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mein_profil_arbeitgeber")
    .update(updates)
    .eq("id", idCheck.data)
    .eq("owner_id", user.id)
    .select(SELECT_FELDER)
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") {
      return NextResponse.json(
        { error: "Arbeitgeber nicht gefunden." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Arbeitgeber konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    aktion: "profil_arbeitgeber_aktualisiert",
    entitaet: "mein_profil_arbeitgeber",
    entitaet_id: idCheck.data,
    quelle: "nutzer",
    details: { updates },
  });

  return NextResponse.json({ ok: true, eintrag: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;
  const idCheck = idSchema.safeParse(id);
  if (!idCheck.success) {
    return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mein_profil_arbeitgeber")
    .delete()
    .eq("id", idCheck.data)
    .eq("owner_id", user.id)
    .select("id, name")
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") {
      return NextResponse.json(
        { error: "Arbeitgeber nicht gefunden." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Arbeitgeber konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    aktion: "profil_arbeitgeber_geloescht",
    entitaet: "mein_profil_arbeitgeber",
    entitaet_id: idCheck.data,
    quelle: "nutzer",
    details: { name: (data as { name: string }).name },
  });

  return NextResponse.json({ ok: true });
}
