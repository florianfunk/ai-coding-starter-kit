// PROJ-16: Adresse (Single-Row pro Owner) — PUT/Upsert.
//
// `mein_profil_adresse` hat `owner_id` als PRIMARY KEY (kein eigenes
// id-Feld) — ein Eintrag pro Nutzer. Wir nutzen Supabase-Upsert mit
// onConflict='owner_id', damit der erste PUT INSERTet und alle weiteren
// UPDATEn.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { adresseSchema } from "@/lib/validation/profil";

const SELECT_FELDER = "strasse, plz, ort, land, updated_at";

export async function PUT(request: Request) {
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

  const parsed = adresseSchema.safeParse(body);
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
    .from("mein_profil_adresse")
    .upsert(
      {
        owner_id: user.id,
        strasse: parsed.data.strasse,
        plz: parsed.data.plz,
        ort: parsed.data.ort,
        land: parsed.data.land,
      },
      { onConflict: "owner_id" },
    )
    .select(SELECT_FELDER)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Adresse konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    aktion: "profil_adresse_aktualisiert",
    entitaet: "mein_profil_adresse",
    entitaet_id: user.id,
    quelle: "nutzer",
    details: { adresse: parsed.data },
  });

  return NextResponse.json({ ok: true, adresse: data });
}
