// PROJ-3: Paperless-Verbindungs-API.
// GET  -> Verbindungs-Status (Basis-URL, ob Token gesetzt, letzter Sync).
//         Token wird NIE im Klartext zurückgegeben.
// PUT  -> Basis-URL + (optional) Token speichern (Upsert via unique owner_id).
//         Token wird via encrypt() verschlüsselt in token_cipher abgelegt.
// Auth Pflicht (getApiUser). RLS ist zweite Verteidigungslinie.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { encrypt } from "@/lib/crypto";
import { paperlessVerbindungSchema } from "@/lib/validation/paperless";

interface VerbindungRow {
  id: string;
  base_url: string;
  token_cipher: string;
  last_sync_at: string | null;
}

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("paperless_verbindung")
    .select("id, base_url, token_cipher, last_sync_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Verbindung konnte nicht geladen werden." },
      { status: 500 },
    );
  }

  const row = data as VerbindungRow | null;
  return NextResponse.json({
    verbindung: row
      ? {
          base_url: row.base_url,
          token_gesetzt: row.token_cipher.length > 0,
          last_sync_at: row.last_sync_at,
        }
      : null,
  });
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

  const v = parsed.data;
  const supabase = await createClient();

  // Bestehende Verbindung laden (für Token-Beibehaltung, wenn keiner gesendet).
  const { data: existing, error: loadError } = await supabase
    .from("paperless_verbindung")
    .select("id, token_cipher")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json(
      { error: "Verbindung konnte nicht geladen werden." },
      { status: 500 },
    );
  }

  let tokenCipher: string;
  if (v.token) {
    try {
      tokenCipher = encrypt(v.token);
    } catch {
      return NextResponse.json(
        {
          error:
            "Token konnte nicht verschlüsselt werden (Server-Konfiguration unvollständig).",
        },
        { status: 500 },
      );
    }
  } else if (existing && (existing as { token_cipher: string }).token_cipher) {
    tokenCipher = (existing as { token_cipher: string }).token_cipher;
  } else {
    return NextResponse.json(
      { error: "Bitte beim ersten Speichern einen API-Token angeben." },
      { status: 422 },
    );
  }

  const { error } = await supabase.from("paperless_verbindung").upsert(
    {
      owner_id: user.id,
      base_url: v.base_url,
      token_cipher: tokenCipher,
    },
    { onConflict: "owner_id" },
  );

  if (error) {
    return NextResponse.json(
      { error: "Verbindung konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    verbindung: {
      base_url: v.base_url,
      token_gesetzt: true,
      last_sync_at:
        (existing as { last_sync_at?: string | null } | null)?.last_sync_at ??
        null,
    },
  });
}
