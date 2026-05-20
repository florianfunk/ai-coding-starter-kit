// PROJ-14: Drill-Down — Buchungen einer Kategorie (mit Filter Jahr/Konto).
// GET /api/kategorien-analyse/buchungen?kategorie_id=uuid|ohne&jahr=&konto_id=
//
// Auth Pflicht (getApiUser), owner-scoped, .limit(2000).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { analyseFilterSchema } from "@/lib/validation/kategorien-analyse";
import { istImBereich } from "@/lib/finanzen/bereich-filter";
import type { Buchung, KategorieTyp } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = analyseFilterSchema.safeParse({
    jahr: url.searchParams.get("jahr") ?? undefined,
    von: url.searchParams.get("von") ?? undefined,
    bis: url.searchParams.get("bis") ?? undefined,
    konto_id: url.searchParams.get("konto_id") ?? undefined,
    bereich: url.searchParams.get("bereich") ?? undefined,
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

  // Datumsbereich: explizite `von`/`bis` haben Vorrang vor `jahr`.
  const von = filter.von ?? (filter.jahr ? `${filter.jahr}-01-01` : null);
  const bis = filter.bis ?? (filter.jahr ? `${filter.jahr}-12-31` : null);
  if (von) q = q.gte("buchung_datum", von);
  if (bis) q = q.lte("buchung_datum", bis);
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
  let buchungen = (data ?? []) as Buchung[];

  // Bereichs-Filter — nur wenn nicht ohnehin auf eine konkrete Kategorie
  // gefiltert wird (eine Kategorie hat genau einen Typ, da entscheidet die
  // Drill-Down-Kategorie schon den Bereich).
  if (filter.bereich !== "alle" && !filter.kategorie_id) {
    const katIds = Array.from(
      new Set(buchungen.map((b) => b.kategorie_id).filter((id): id is string => !!id)),
    );
    const katMap = new Map<string, KategorieTyp>();
    if (katIds.length > 0) {
      const { data: kData } = await supabase
        .from("kategorie")
        .select("id, typ")
        .eq("owner_id", user.id)
        .in("id", katIds);
      for (const k of (kData ?? []) as Array<{ id: string; typ: KategorieTyp }>) {
        katMap.set(k.id, k.typ);
      }
    }
    buchungen = buchungen.filter((b) =>
      istImBereich(
        {
          klassifikation: b.klassifikation,
          kategorieTyp: b.kategorie_id ? (katMap.get(b.kategorie_id) ?? null) : null,
        },
        filter.bereich,
      ),
    );
  }

  return NextResponse.json({ buchungen });
}
