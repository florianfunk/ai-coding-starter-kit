// PROJ-16: Familienmitglieder-Liste (POST = neu).
//
// Analog zu Arbeitgeber: `name_normalisiert` wird serverseitig gesetzt.
// Familien-Namen sind PII und werden NIE im Web nachgeschlagen — die
// Pipeline behandelt sie nur als Schluessel-Match (PROJ-15 / PROJ-16).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { familieSchema } from "@/lib/validation/profil";
import { normalisiereProfilName } from "@/lib/classifier/profil";

const SELECT_FELDER =
  "id, name, name_normalisiert, rolle, auch_geschaeftspartner, notiz, updated_at";

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

  const parsed = familieSchema.safeParse(body);
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
  const name_normalisiert = normalisiereProfilName(parsed.data.name);

  const { data, error } = await supabase
    .from("mein_profil_familie")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      name_normalisiert,
      rolle: parsed.data.rolle,
      auch_geschaeftspartner: parsed.data.auch_geschaeftspartner,
      notiz: parsed.data.notiz,
    })
    .select(SELECT_FELDER)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Familienmitglied konnte nicht angelegt werden." },
      { status: 500 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    aktion: "profil_familie_angelegt",
    entitaet: "mein_profil_familie",
    entitaet_id: (data as { id: string }).id,
    quelle: "nutzer",
    details: {
      name: parsed.data.name,
      rolle: parsed.data.rolle,
      auch_geschaeftspartner: parsed.data.auch_geschaeftspartner,
    },
  });

  return NextResponse.json({ ok: true, eintrag: data }, { status: 201 });
}
