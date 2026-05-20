// PROJ-14: Drill-Down — Buchungen einer Kategorie (mit Filter Jahr/Konto).
// GET /api/kategorien-analyse/buchungen?kategorie_id=uuid|ohne&jahr=&konto_id=
//
// Auth Pflicht (getApiUser), owner-scoped, .limit(2000).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { analyseFilterSchema } from "@/lib/validation/kategorien-analyse";
import type { Buchung } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = analyseFilterSchema.safeParse({
    jahr: url.searchParams.get("jahr") ?? undefined,
    konto_id: url.searchParams.get("konto_id") ?? undefined,
    nur_steuerrelevant: url.searchParams.get("nur_steuerrelevant") ?? undefined,
    kategorie_id: url.searchParams.get("kategorie_id") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültiger Filter" },
      { status: 422 },
    );
  }
  const filter = parsed.data;

  const supabase = await createClient();
  let q = supabase
    .from("buchung")
    .select(
      "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund, parent_buchung_id, split_anteil",
    )
    .eq("owner_id", user.id)
    .order("buchung_datum", { ascending: false })
    .order("id", { ascending: false })
    .limit(2000);

  if (filter.jahr) {
    q = q.gte("buchung_datum", `${filter.jahr}-01-01`).lte(
      "buchung_datum",
      `${filter.jahr}-12-31`,
    );
  }
  if (filter.konto_id) q = q.eq("konto_id", filter.konto_id);
  if (filter.nur_steuerrelevant) q = q.eq("steuerrelevant", true);

  if (filter.kategorie_id === "ohne") {
    q = q.is("kategorie_id", null);
  } else if (filter.kategorie_id) {
    q = q.eq("kategorie_id", filter.kategorie_id);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  return NextResponse.json({ buchungen: (data ?? []) as Buchung[] });
}
