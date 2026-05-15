// PROJ-7: Lernregel-Verwaltung.
//
// GET  -> Liste aller Regeln des Eigentümers, nach Priorität (höchste zuerst).
// POST -> neue Regel anlegen. Konfliktwarnung im Response, wenn die neue
//         Regel mit einer bestehenden aktiven Regel gleicher Priorität
//         kollidiert (gleiche Bedingung, abweichende Aktion).
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  regelInputSchema,
  findeRegelKonflikte,
  type RegelFuerKonflikt,
} from "@/lib/validation/regel";
import type { Lernregel } from "@/lib/types";

const SELECT_FELDER =
  "id, bezeichnung, bedingung, aktion, prioritaet, aktiv, treffer_zaehler";

/** GET /api/regeln — alle Lernregeln, höchste Priorität zuerst. */
export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lernregel")
    .select(SELECT_FELDER)
    .eq("owner_id", user.id)
    .order("prioritaet", { ascending: false })
    .order("bezeichnung", { ascending: true })
    .limit(1000);

  if (error) {
    return NextResponse.json(
      { error: "Lernregeln konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: (data ?? []) as Lernregel[] });
}

/** POST /api/regeln — neue Lernregel anlegen. */
export async function POST(request: Request) {
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

  const parsed = regelInputSchema.safeParse(body);
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

  // Bestehende Regeln für die Konfliktprüfung laden (owner-scoped).
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
    .insert({
      owner_id: user.id,
      bezeichnung: parsed.data.bezeichnung,
      bedingung: parsed.data.bedingung,
      aktion: parsed.data.aktion,
      prioritaet: parsed.data.prioritaet,
      aktiv: parsed.data.aktiv,
    })
    .select(SELECT_FELDER)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Lernregel konnte nicht angelegt werden." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      data: data as Lernregel,
      konflikte,
      warnung:
        konflikte.length > 0
          ? "Diese Regel kollidiert mit bestehenden Regeln gleicher Priorität. Solche Fälle landen weiterhin in der Prüfliste."
          : undefined,
    },
    { status: 201 },
  );
}
