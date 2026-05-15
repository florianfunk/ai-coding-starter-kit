// PROJ-7: Lernregel bearbeiten / löschen.
//
// PUT    -> Regel bearbeiten (inkl. aktiv-Schalter und Priorität).
//           Konfliktwarnung im Response (eigene Regel ausgeschlossen).
// DELETE  -> Regel hart löschen. Erlaubt, weil Lernregeln nur künftige
//            Klassifizierungen steuern; bereits (auto-/manuell-)verbuchte
//            Buchungen referenzieren regel_id ON DELETE SET NULL und bleiben
//            unverändert (Rückwirkungsschutz auf DB-Ebene).
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  regelUpdateSchema,
  findeRegelKonflikte,
  type RegelFuerKonflikt,
} from "@/lib/validation/regel";
import type { Lernregel } from "@/lib/types";

const SELECT_FELDER =
  "id, bezeichnung, bedingung, aktion, prioritaet, aktiv, treffer_zaehler";

const idSchema = z.uuid("Ungültige ID");

/** PUT /api/regeln/[id] — Lernregel bearbeiten. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;
  const idCheck = idSchema.safeParse(id);
  if (!idCheck.success) {
    return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
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

  const parsed = regelUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const supabase = await createClient();

  const { data: bestehendeData } = await supabase
    .from("lernregel")
    .select("id, bezeichnung, bedingung, aktion, prioritaet, aktiv")
    .eq("owner_id", user.id)
    .limit(1000);
  const bestehende = (bestehendeData ?? []) as Array<
    RegelFuerKonflikt & { bezeichnung: string }
  >;
  const bezeichnungen = Object.fromEntries(
    bestehende.map((r) => [r.id, r.bezeichnung]),
  );
  const konflikte = findeRegelKonflikte(
    {
      id: idCheck.data,
      bedingung: parsed.data.bedingung,
      aktion: parsed.data.aktion,
      prioritaet: parsed.data.prioritaet,
      aktiv: parsed.data.aktiv,
    },
    bestehende,
    bezeichnungen,
  );

  const { data, error } = await supabase
    .from("lernregel")
    .update({
      bezeichnung: parsed.data.bezeichnung,
      bedingung: parsed.data.bedingung,
      aktion: parsed.data.aktion,
      prioritaet: parsed.data.prioritaet,
      aktiv: parsed.data.aktiv,
    })
    .eq("id", idCheck.data)
    .eq("owner_id", user.id)
    .select(SELECT_FELDER)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Lernregel nicht gefunden." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Lernregel konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: data as Lernregel,
    konflikte,
    warnung:
      konflikte.length > 0
        ? "Diese Regel kollidiert mit bestehenden Regeln gleicher Priorität. Solche Fälle landen weiterhin in der Prüfliste."
        : undefined,
  });
}

/** DELETE /api/regeln/[id] — Lernregel löschen (kein Rückwirkungseffekt). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await params;
  const idCheck = idSchema.safeParse(id);
  if (!idCheck.success) {
    return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lernregel")
    .delete()
    .eq("id", idCheck.data)
    .eq("owner_id", user.id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Lernregel nicht gefunden." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Lernregel konnte nicht gelöscht werden." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data,
    message:
      "Lernregel gelöscht. Bereits verbuchte Buchungen bleiben unverändert.",
  });
}
