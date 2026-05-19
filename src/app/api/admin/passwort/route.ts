// PROJ-13: Passwortänderung mit serverseitiger Re-Auth.
// POST -> aktuelles Passwort wird per signInWithPassword geprüft (Re-Auth),
//         danach neues Passwort via updateUser gesetzt.
// Auth Pflicht (getApiUser). Bei falschem aktuellem Passwort: 403.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { passwortAendernSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json(
      { error: "Konto ohne E-Mail — Passwortänderung nicht möglich." },
      { status: 400 },
    );
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

  const parsed = passwortAendernSchema.safeParse(body);
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

  // Re-Auth: aktuelles Passwort verifizieren (gleiche E-Mail/derselbe Nutzer).
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: v.aktuelles_passwort,
  });

  if (reauthError) {
    return NextResponse.json(
      { error: "Aktuelles Passwort falsch." },
      { status: 403 },
    );
  }

  // Neues Passwort setzen.
  const { error: updateError } = await supabase.auth.updateUser({
    password: v.neues_passwort,
  });

  if (updateError) {
    return NextResponse.json(
      {
        error:
          updateError.message ||
          "Passwort konnte nicht geändert werden.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
