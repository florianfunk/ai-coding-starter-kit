// PROJ-16: Konto-Toggle "ist_eigenes_konto".
//
// PATCH /api/konten/[id]/eigenes — Body: { ist_eigenes_konto: boolean }.
// Bewusst eigener kleiner Endpunkt statt Erweiterung von
// `PUT /api/konten/[id]`, weil PUT dort komplette Konto-Daten erwartet
// (Bezeichnung/Typ/Mapping) und ein partieller Update mit `replace_all`
// das Mapping versehentlich nullen wuerde.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { kontoEigenesSchema } from "@/lib/validation/profil";

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

  const parsed = kontoEigenesSchema.safeParse(body);
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
  const { data, error } = await supabase
    .from("konto")
    .update({ ist_eigenes_konto: parsed.data.ist_eigenes_konto })
    .eq("id", idCheck.data)
    .eq("owner_id", user.id)
    .select("id, bezeichnung, ist_eigenes_konto")
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") {
      return NextResponse.json(
        { error: "Konto nicht gefunden." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Konto konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    aktion: "profil_konto_eigenes_aktualisiert",
    entitaet: "konto",
    entitaet_id: idCheck.data,
    quelle: "nutzer",
    details: { ist_eigenes_konto: parsed.data.ist_eigenes_konto },
  });

  return NextResponse.json({ ok: true, konto: data });
}
