// PROJ-14: Inline-Edit einer einzelnen Buchung.
// PATCH /api/buchungen/[id]
//
// Erlaubte Felder: kategorie_id, klassifikation, steuerrelevant, ust_satz,
// bestaetigen (→ status=manuell_bestaetigt). Jede Änderung schreibt einen
// audit_eintrag mit quelle="nutzer" für Nachvollziehbarkeit.
//
// Auth Pflicht (getApiUser), owner-scoped, Zod-validiert.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { buchungPatchSchema } from "@/lib/validation/kategorien-analyse";
import type { KategorieTyp } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const parsed = buchungPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen" },
      { status: 422 },
    );
  }
  const patch = parsed.data;

  const supabase = await createClient();

  // Buchung laden (Ownership + Snapshot vorher).
  const { data: vorher, error: ladeErr } = await supabase
    .from("buchung")
    .select(
      "id, kategorie_id, klassifikation, steuerrelevant, ust_satz, status",
    )
    .eq("owner_id", user.id)
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (ladeErr) {
    return NextResponse.json({ error: "Ladefehler." }, { status: 500 });
  }
  if (!vorher) {
    return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 });
  }

  // Bei neuer kategorie_id: Typ ermitteln und ggf. klassifikation/steuerrelevant
  // automatisch konsistent setzen (privat → klassifikation=privat, steuerrelevant=false,
  // ust_satz=null).
  const updates: Record<string, unknown> = {};
  let neuerKatTyp: KategorieTyp | null = null;
  if (patch.kategorie_id !== undefined) {
    updates.kategorie_id = patch.kategorie_id;
    if (patch.kategorie_id) {
      const { data: kat } = await supabase
        .from("kategorie")
        .select("typ, ust_satz")
        .eq("owner_id", user.id)
        .eq("id", patch.kategorie_id)
        .limit(1)
        .maybeSingle();
      if (!kat) {
        return NextResponse.json(
          { error: "Kategorie nicht gefunden." },
          { status: 404 },
        );
      }
      const k = kat as { typ: KategorieTyp; ust_satz: number | null };
      neuerKatTyp = k.typ;
      // Auto-Konsistenz: explizite Werte aus patch haben Vorrang.
      if (patch.klassifikation === undefined) {
        if (k.typ === "privat") updates.klassifikation = "privat";
        else if (k.typ === "neutral") updates.klassifikation = "neutral";
        else if (k.typ === "einnahme" || k.typ === "ausgabe")
          updates.klassifikation = "geschaeftlich";
      }
      if (patch.steuerrelevant === undefined) {
        updates.steuerrelevant = k.typ === "einnahme" || k.typ === "ausgabe";
      }
      if (patch.ust_satz === undefined) {
        updates.ust_satz = k.typ === "privat" || k.typ === "neutral" ? null : k.ust_satz;
      }
    }
  }
  if (patch.klassifikation !== undefined) updates.klassifikation = patch.klassifikation;
  if (patch.steuerrelevant !== undefined) updates.steuerrelevant = patch.steuerrelevant;
  if (patch.ust_satz !== undefined) updates.ust_satz = patch.ust_satz;
  if (patch.bestaetigen === true) {
    updates.status = "manuell_bestaetigt";
    updates.quelle = "manuell";
    updates.pruef_grund = null;
  }

  const { data: nachher, error: updErr } = await supabase
    .from("buchung")
    .update(updates)
    .eq("owner_id", user.id)
    .eq("id", id)
    .select(
      "id, kategorie_id, klassifikation, steuerrelevant, ust_satz, status",
    )
    .single();
  if (updErr) {
    return NextResponse.json(
      { error: "Update fehlgeschlagen: " + updErr.message },
      { status: 500 },
    );
  }

  // Audit-Eintrag
  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    entitaet: "buchung",
    entitaet_id: id,
    aktion: patch.bestaetigen ? "manuell_bestaetigt" : "manuell_korrigiert",
    quelle: "nutzer",
    details: {
      vorher,
      nachher,
      patch,
      neuer_kategorie_typ: neuerKatTyp,
    },
  });

  return NextResponse.json({ buchung: nachher });
}
