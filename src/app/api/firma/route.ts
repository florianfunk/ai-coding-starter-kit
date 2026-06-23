// PROJ-1: Firmen-/Steuerprofil-API.
// GET  -> aktuelles Profil des eingeloggten Nutzers (oder null).
// PUT  -> Profil anlegen/aktualisieren (Upsert, genau ein Satz via unique owner_id).
// Auth Pflicht (getApiUser). RLS ist zweite Verteidigungslinie.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { firmenprofilSchema } from "@/lib/validation/firma";
import type { Firmenprofil } from "@/lib/types";

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("firmenprofil")
    .select(
      "id, firmenname, inhaber, steuernummer, ust_idnr, strasse, plz, ort, finanzamt, rechtsform, ust_status, wirtschaftsjahr_beginn, ust_va_rhythmus, rhythmus_gueltig_ab, dauerfristverlaengerung",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Profil konnte nicht geladen werden." },
      { status: 500 },
    );
  }

  return NextResponse.json({ profil: (data as Firmenprofil | null) ?? null });
}

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

  const parsed = firmenprofilSchema.safeParse(body);
  if (!parsed.success) {
    const erstes = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: erstes
          ? `${erstes.path.join(".") || "Eingabe"}: ${erstes.message}`
          : "Validierung fehlgeschlagen.",
      },
      { status: 422 },
    );
  }

  const v = parsed.data;
  const supabase = await createClient();

  // Upsert auf unique(owner_id): genau ein Datensatz pro Account.
  const { data, error } = await supabase
    .from("firmenprofil")
    .upsert(
      {
        owner_id: user.id,
        firmenname: v.firmenname,
        inhaber: v.inhaber,
        steuernummer: v.steuernummer ?? null,
        ust_idnr: v.ust_idnr ?? null,
        strasse: v.strasse ?? null,
        plz: v.plz ?? null,
        ort: v.ort ?? null,
        finanzamt: v.finanzamt ?? null,
        rechtsform: v.rechtsform,
        ust_status: v.ust_status,
        wirtschaftsjahr_beginn: v.wirtschaftsjahr_beginn,
        ust_va_rhythmus: v.ust_va_rhythmus,
        rhythmus_gueltig_ab: v.rhythmus_gueltig_ab ?? null,
        dauerfristverlaengerung: v.dauerfristverlaengerung,
      },
      { onConflict: "owner_id" },
    )
    .select(
      "id, firmenname, inhaber, steuernummer, ust_idnr, strasse, plz, ort, finanzamt, rechtsform, ust_status, wirtschaftsjahr_beginn, ust_va_rhythmus, rhythmus_gueltig_ab, dauerfristverlaengerung",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Profil konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  return NextResponse.json({ profil: data as Firmenprofil });
}
