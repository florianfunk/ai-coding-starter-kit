// PATCH/DELETE einer Empfaenger-Kuendigungs-Markierung.
//
// Schluessel ist der bereits normalisierte Empfaenger (in der URL).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  status: z.enum(["offen", "gekuendigt", "beendet"]).optional(),
  notiz: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ norm: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { norm } = await params;
  const empfaengerNorm = decodeURIComponent(norm).trim();
  if (empfaengerNorm.length < 2) {
    return NextResponse.json({ error: "Ungueltiger Schluessel." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiger Body." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen" },
      { status: 422 },
    );
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.notiz !== undefined) updates.notiz = parsed.data.notiz;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Keine Aenderungen angegeben." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empfaenger_kuendigung")
    .update(updates)
    .eq("owner_id", user.id)
    .eq("empfaenger_norm", empfaengerNorm)
    .select("empfaenger_norm, status, notiz, markiert_am")
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: "Update fehlgeschlagen: " + error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Markierung nicht gefunden." },
      { status: 404 },
    );
  }
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ norm: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { norm } = await params;
  const empfaengerNorm = decodeURIComponent(norm).trim();
  if (empfaengerNorm.length < 2) {
    return NextResponse.json({ error: "Ungueltiger Schluessel." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("empfaenger_kuendigung")
    .delete()
    .eq("owner_id", user.id)
    .eq("empfaenger_norm", empfaengerNorm);
  if (error) {
    return NextResponse.json(
      { error: "Loeschen fehlgeschlagen: " + error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
