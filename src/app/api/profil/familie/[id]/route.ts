// PROJ-16: Familienmitglied bearbeiten / loeschen — analog zu Arbeitgeber.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { familieUpdateSchema } from "@/lib/validation/profil";
import { normalisiereProfilName } from "@/lib/classifier/profil";

const SELECT_FELDER =
  "id, name, name_normalisiert, rolle, auch_geschaeftspartner, notiz, updated_at";

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

  const parsed = familieUpdateSchema.safeParse(body);
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
  if (parsed.data.rolle !== undefined) updates.rolle = parsed.data.rolle;
  if (parsed.data.auch_geschaeftspartner !== undefined) {
    updates.auch_geschaeftspartner = parsed.data.auch_geschaeftspartner;
  }
  if (parsed.data.notiz !== undefined) updates.notiz = parsed.data.notiz;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Keine Aenderungen uebergeben." },
      { status: 422 },
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mein_profil_familie")
    .update(updates)
    .eq("id", idCheck.data)
    .eq("owner_id", user.id)
    .select(SELECT_FELDER)
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") {
      return NextResponse.json(
        { error: "Familienmitglied nicht gefunden." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Familienmitglied konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    aktion: "profil_familie_aktualisiert",
    entitaet: "mein_profil_familie",
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
    .from("mein_profil_familie")
    .delete()
    .eq("id", idCheck.data)
    .eq("owner_id", user.id)
    .select("id, name")
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") {
      return NextResponse.json(
        { error: "Familienmitglied nicht gefunden." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Familienmitglied konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    aktion: "profil_familie_geloescht",
    entitaet: "mein_profil_familie",
    entitaet_id: idCheck.data,
    quelle: "nutzer",
    details: { name: (data as { name: string }).name },
  });

  return NextResponse.json({ ok: true });
}
