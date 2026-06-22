// PROJ-13: KI-Einstellungen (AI-Gateway-Key + Modell).
// GET  -> Status: ai_model + ai_key_gesetzt (boolean). NIE Klartext-Key.
// PUT  -> Upsert via unique owner_id. Key via encrypt() wenn nicht-leer,
//         sonst bestehenden ai_key_cipher behalten (Paperless-Token-Pattern).
// Auth Pflicht (getApiUser). RLS ist zweite Verteidigungslinie.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { encrypt } from "@/lib/crypto";
import { aiEinstellungSchema } from "@/lib/validation/admin";
import { STANDARD_MODELL } from "@/lib/admin/claude-modelle";

const DEFAULT_MODEL = STANDARD_MODELL;

interface EinstellungRow {
  ai_key_cipher: string | null;
  ai_model: string | null;
}

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_einstellung")
    .select("ai_key_cipher, ai_model")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Einstellungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  const row = data as EinstellungRow | null;
  return NextResponse.json({
    ai_model: row?.ai_model?.trim() || DEFAULT_MODEL,
    ai_key_gesetzt: (row?.ai_key_cipher ?? "").trim().length > 0,
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

  const parsed = aiEinstellungSchema.safeParse(body);
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

  // Bestehende Einstellung laden (für Key-Beibehaltung bei leerer Eingabe).
  const { data: existing, error: loadError } = await supabase
    .from("app_einstellung")
    .select("ai_key_cipher")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json(
      { error: "Einstellungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  const bestehenderCipher =
    (existing as { ai_key_cipher: string | null } | null)?.ai_key_cipher ?? null;

  let keyCipher: string | null;
  if (v.ai_key) {
    try {
      keyCipher = encrypt(v.ai_key);
    } catch {
      return NextResponse.json(
        {
          error:
            "Key konnte nicht verschlüsselt werden (Server-Konfiguration unvollständig).",
        },
        { status: 500 },
      );
    }
  } else {
    // Leere Eingabe: bestehenden Key beibehalten (kann auch null sein).
    keyCipher = bestehenderCipher;
  }

  const { error } = await supabase.from("app_einstellung").upsert(
    {
      owner_id: user.id,
      ai_key_cipher: keyCipher,
      ai_model: v.ai_model,
    },
    { onConflict: "owner_id" },
  );

  if (error) {
    return NextResponse.json(
      { error: "Einstellungen konnten nicht gespeichert werden." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ai_model: v.ai_model,
    ai_key_gesetzt: (keyCipher ?? "").trim().length > 0,
  });
}
