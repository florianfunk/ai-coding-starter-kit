// PROJ-13: E-Mail-Adresse ändern (Login-Mail).
// POST -> aktuelles Passwort wird per signInWithPassword geprüft (Re-Auth),
//         danach wird die neue E-Mail via updateUser({email}) angestossen.
//
// Supabase verschickt automatisch eine Bestätigungsmail an die neue
// Adresse — die Login-E-Mail wird erst nach Klick auf den Link aktiv.
// Solange du nicht klickst, bleibt das alte Login gültig.
//
// Single-Tenant-Hinweis: Wenn STEUERAGENT_ALLOWED_EMAIL gesetzt ist, muss
// diese Env-Variable nach erfolgreichem E-Mail-Wechsel ebenfalls auf die
// neue Adresse umgestellt und die App neu deployed werden — sonst sperrt
// sich der Nutzer beim nächsten Login selbst aus. Wir liefern dieses
// Risiko explizit im Response-Payload mit (`allow_list_warnung`), damit
// die UI darauf hinweisen kann.
//
// Auth Pflicht (getApiUser). Bei falschem aktuellem Passwort: 403.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { emailAendernSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json(
      { error: "Konto ohne E-Mail — Wechsel nicht möglich." },
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

  const parsed = emailAendernSchema.safeParse(body);
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

  if (v.neue_email === user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Die neue E-Mail ist identisch mit der aktuellen." },
      { status: 422 },
    );
  }

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

  // Neue E-Mail anstossen — Supabase verschickt Bestätigungslink.
  const { error: updateError } = await supabase.auth.updateUser({
    email: v.neue_email,
  });
  if (updateError) {
    return NextResponse.json(
      {
        error:
          updateError.message ||
          "E-Mail konnte nicht geändert werden.",
      },
      { status: 400 },
    );
  }

  // Single-Tenant-Allow-List checken — wenn aktiv und nicht passend,
  // explizit warnen.
  const allowList = process.env.STEUERAGENT_ALLOWED_EMAIL?.toLowerCase();
  const allowListWarnung =
    allowList && allowList !== v.neue_email
      ? `Achtung: STEUERAGENT_ALLOWED_EMAIL ist auf "${allowList}" gesetzt. Bevor du den Bestätigungslink anklickst, musst du diese Env-Variable auf "${v.neue_email}" umstellen und die App neu deployen — sonst sperrst du dich aus.`
      : null;

  return NextResponse.json({
    ok: true,
    pending_email: v.neue_email,
    info:
      "Bestätigungslink wurde an die neue Adresse versendet. Bis du klickst, bleibt deine bestehende Login-E-Mail aktiv.",
    allow_list_warnung: allowListWarnung,
  });
}
