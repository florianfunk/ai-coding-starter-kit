// PROJ-16: Arbeitgeber-Liste (POST = neu).
//
// POST -> neuen Arbeitgeber anlegen. `name_normalisiert` wird serverseitig
//         via `normalisiereProfilName` gesetzt (identische Normalisierung
//         wie buchung.empfaenger_normalisiert). Audit-Eintrag in
//         audit_eintrag.
//
// Response enthaelt optional `lernregel_vorschlag` — wenn der Kontenrahmen
// eine passende Lohn/Gehalt/Anstellung-Kategorie (typ privat/neutral)
// hat, schlagen wir der UI vor, automatisch eine Lernregel anzulegen
// (UI fragt per Toast Ja/Nein und ruft dann selbst POST /api/regeln auf).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { arbeitgeberSchema } from "@/lib/validation/profil";
import { normalisiereProfilName } from "@/lib/classifier/profil";
import {
  ermittleLohnKategorie,
  baueLernregelVorschlag,
  type LernregelVorschlag,
} from "@/lib/classifier/profil-lernregel";

const SELECT_FELDER =
  "id, name, name_normalisiert, aktiv_von, aktiv_bis, notiz, updated_at";

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

  const parsed = arbeitgeberSchema.safeParse(body);
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
    .from("mein_profil_arbeitgeber")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      name_normalisiert,
      aktiv_von: parsed.data.aktiv_von,
      aktiv_bis: parsed.data.aktiv_bis,
      notiz: parsed.data.notiz,
    })
    .select(SELECT_FELDER)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Arbeitgeber konnte nicht angelegt werden." },
      { status: 500 },
    );
  }

  // Audit (best effort).
  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    aktion: "profil_arbeitgeber_angelegt",
    entitaet: "mein_profil_arbeitgeber",
    entitaet_id: (data as { id: string }).id,
    quelle: "nutzer",
    details: { name: parsed.data.name, name_normalisiert },
  });

  // Lernregel-Vorschlag: wenn der Kontenrahmen eine passende Lohn/Gehalt-
  // Kategorie hat, der UI das Anbieten lassen. Niemals automatisch
  // anlegen — nur Vorschlag.
  let lernregel_vorschlag: LernregelVorschlag | null = null;
  const kat = await ermittleLohnKategorie(supabase, user.id);
  if (kat) {
    lernregel_vorschlag = baueLernregelVorschlag(name_normalisiert, kat);
  }

  return NextResponse.json(
    { ok: true, eintrag: data, lernregel_vorschlag },
    { status: 201 },
  );
}
