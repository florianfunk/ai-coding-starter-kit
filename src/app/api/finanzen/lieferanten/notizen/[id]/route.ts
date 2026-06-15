// PROJ-21 — Lieferanten-Notiz: Bearbeiten & Löschen.
//
// PATCH  → Text einer Notiz ändern. Body { inhalt }. Setzt aktualisiert_am.
// DELETE → Notiz löschen (idempotent: 200 auch wenn schon weg).
// Beide owner-scoped (RLS + explizit) und mit Audit-Eintrag.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { lieferantNotizUpdateSchema } from "@/lib/validation/lieferant-notiz";
import type { LieferantNotizRow } from "@/lib/finanzen/lieferant-notizen";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SELECT =
  "id, empfaenger_norm, rohwert_beispiel, inhalt, erstellt_am, aktualisiert_am";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }
  const parsed = lieferantNotizUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen" },
      { status: 422 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lieferant_notiz")
    .update({
      inhalt: parsed.data.inhalt,
      aktualisiert_am: new Date().toISOString(),
    })
    .eq("owner_id", user.id)
    .eq("id", id)
    .select(SELECT)
    .maybeSingle();
  if (error) {
    console.error("lieferant_notiz update:", error.message);
    return NextResponse.json(
      { error: "Update fehlgeschlagen." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Notiz nicht gefunden." },
      { status: 404 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    entitaet: "lieferant_notiz",
    entitaet_id: id,
    aktion: "notiz_bearbeitet",
    quelle: "nutzer",
    details: { empfaenger_norm: (data as LieferantNotizRow).empfaenger_norm },
  });

  const row = data as LieferantNotizRow;
  return NextResponse.json({
    notiz: {
      id: row.id,
      empfaenger_norm: row.empfaenger_norm,
      inhalt: row.inhalt,
      erstellt_am: row.erstellt_am,
      aktualisiert_am: row.aktualisiert_am,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("lieferant_notiz")
    .delete()
    .eq("owner_id", user.id)
    .eq("id", id);
  if (error) {
    console.error("lieferant_notiz delete:", error.message);
    return NextResponse.json(
      { error: "Löschen fehlgeschlagen." },
      { status: 500 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    entitaet: "lieferant_notiz",
    entitaet_id: id,
    aktion: "notiz_geloescht",
    quelle: "nutzer",
    details: {},
  });

  return NextResponse.json({ ok: true });
}
