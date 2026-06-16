// PROJ-22: Globaler Jahreswähler — aktives Jahr setzen.
// PATCH { aktives_jahr: number | null }  (null = "Alle Jahre")
// Auth Pflicht, owner-scoped, Audit-Eintrag. RLS ist zweite Verteidigungslinie.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";

const jahrSchema = z.object({
  aktives_jahr: z
    .union([z.coerce.number().int().min(2000).max(2100), z.null()])
    .nullable(),
});

export async function PATCH(request: Request) {
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

  const parsed = jahrSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültiges Jahr (2000–2100 oder null)." },
      { status: 422 },
    );
  }

  const aktivesJahr = parsed.data.aktives_jahr;
  const supabase = await createClient();

  // Es existiert genau ein Profil pro Account (unique owner_id). Update-only:
  // ohne Profil kann kein Jahr gesetzt werden (firmenname/inhaber sind Pflicht).
  const { data, error } = await supabase
    .from("firmenprofil")
    .update({ aktives_jahr: aktivesJahr })
    .eq("owner_id", user.id)
    .select("aktives_jahr")
    .maybeSingle();

  if (error) {
    console.error("[firma/jahr] update fehlgeschlagen", error.message);
    return NextResponse.json(
      { error: "Jahr konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Kein Firmenprofil vorhanden. Bitte zuerst Stammdaten anlegen." },
      { status: 409 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    entitaet: "firmenprofil",
    aktion: "aktives_jahr_gesetzt",
    quelle: "nutzer",
    details: { aktives_jahr: aktivesJahr },
  });

  return NextResponse.json({ aktives_jahr: aktivesJahr });
}
