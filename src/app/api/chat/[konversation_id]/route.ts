// PROJ-17 — Eine Konversation: GET (Header + Nachrichten + Aktionen),
// PATCH (Titel), DELETE (Konversation + Kaskaden).
//
// Owner-scoped via getApiUser(). RLS deckt zusaetzlich ab.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  aktualisiereTitel,
  holeKonversation,
  loescheKonversation,
} from "@/lib/chat/konversation";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ konversation_id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { konversation_id } = await params;
  if (!UUID.test(konversation_id)) {
    return NextResponse.json({ error: "Ungueltige ID." }, { status: 400 });
  }
  const supabase = await createClient();
  const result = await holeKonversation(supabase, user.id, konversation_id);
  if (!result) {
    return NextResponse.json(
      { error: "Konversation nicht gefunden." },
      { status: 404 },
    );
  }
  return NextResponse.json(result);
}

const patchSchema = z.object({
  titel: z.string().trim().min(1).max(200),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ konversation_id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { konversation_id } = await params;
  if (!UUID.test(konversation_id)) {
    return NextResponse.json({ error: "Ungueltige ID." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body." },
      { status: 400 },
    );
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen." },
      { status: 422 },
    );
  }
  const supabase = await createClient();
  const ok = await aktualisiereTitel(
    supabase,
    user.id,
    konversation_id,
    parsed.data.titel,
  );
  if (!ok) {
    return NextResponse.json(
      { error: "Titel konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ konversation_id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { konversation_id } = await params;
  if (!UUID.test(konversation_id)) {
    return NextResponse.json({ error: "Ungueltige ID." }, { status: 400 });
  }
  const supabase = await createClient();
  const ok = await loescheKonversation(supabase, user.id, konversation_id);
  if (!ok) {
    return NextResponse.json(
      { error: "Konversation nicht gefunden oder Loeschung fehlgeschlagen." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
