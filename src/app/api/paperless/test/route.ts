// PROJ-3: Paperless-Verbindungstest.
// POST -> testet die Erreichbarkeit der Paperless-Instanz mit dem
//         gespeicherten (verschlüsselten) Token, ODER mit einem im Body
//         übergebenen base_url/token (vor dem Speichern).
// Auth Pflicht. Token wird NIE geloggt, NIE zurückgegeben.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { decrypt } from "@/lib/crypto";
import { paperlessVerbindungSchema } from "@/lib/validation/paperless";
import { testConnection } from "@/lib/paperless/client";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  // Body ist optional: leerer Body => gespeicherte Verbindung testen.
  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  let baseUrl: string | undefined;
  let token: string | undefined;

  const hasBodyInput =
    body && typeof body === "object" && "base_url" in body;

  if (hasBodyInput) {
    const parsed = paperlessVerbindungSchema.safeParse(body);
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
    baseUrl = parsed.data.base_url;
    token = parsed.data.token;
  }

  // base_url und/oder Token aus gespeicherter Verbindung ergänzen.
  if (!baseUrl || !token) {
    const { data, error } = await supabase
      .from("paperless_verbindung")
      .select("base_url, token_cipher")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Verbindung konnte nicht geladen werden." },
        { status: 500 },
      );
    }
    const row = data as { base_url: string; token_cipher: string } | null;
    if (!row) {
      return NextResponse.json(
        { error: "Noch keine Paperless-Verbindung gespeichert." },
        { status: 404 },
      );
    }
    baseUrl = baseUrl ?? row.base_url;
    if (!token) {
      try {
        token = decrypt(row.token_cipher);
      } catch {
        return NextResponse.json(
          {
            error:
              "Gespeicherter Token konnte nicht entschlüsselt werden. Bitte Token erneut speichern.",
          },
          { status: 500 },
        );
      }
    }
  }

  const result = await testConnection(baseUrl, token);
  if (result.ok) {
    return NextResponse.json({ ok: true, message: "Verbindung erfolgreich." });
  }
  return NextResponse.json(
    { ok: false, error: result.message },
    { status: 502 },
  );
}
