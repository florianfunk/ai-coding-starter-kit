// PROJ-17 — Chat-Konversationen: Liste + Neuanlage.
//
// GET  /api/chat/konversationen — Liste mit Titel/Datum/Vorschau
// POST /api/chat/konversationen — neue Konversation (optionaler Titel)
//
// Owner-scoped via getApiUser(). RLS deckt zusaetzlich ab.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  holeKonversationen,
  legeKonversationAn,
} from "@/lib/chat/konversation";

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const supabase = await createClient();
  const konversationen = await holeKonversationen(supabase, user.id);
  return NextResponse.json({ konversationen });
}

const postSchema = z.object({
  titel: z.string().trim().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Leerer Body ist erlaubt — Titel-Default kommt aus dem DB-Default.
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen." },
      { status: 422 },
    );
  }
  const supabase = await createClient();
  const k = await legeKonversationAn(supabase, user.id, parsed.data.titel);
  if (!k) {
    return NextResponse.json(
      { error: "Konversation konnte nicht angelegt werden." },
      { status: 500 },
    );
  }
  return NextResponse.json({ konversation: k });
}
