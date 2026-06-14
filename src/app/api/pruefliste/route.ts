// PROJ-7: Prüfliste — offene Ausnahmen (Buchungen mit status='zur_pruefung').
//
// GET -> alle Prüffälle des Eigentümers mit Grund (pruef_grund), filter- und
//        sortierbar (Konto, Grund; Sortierung Datum/Betrag). Zusätzlich eine
//        Mustergruppierung: Fälle mit gleichem normalisierten Empfänger werden
//        zu Gruppen zusammengefasst, damit viele gleichartige Fälle in einem
//        Schritt erledigt werden können (Bulk).
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import type { Buchung } from "@/lib/types";

const SELECT_FELDER =
  "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund, parent_buchung_id, split_anteil, gemerkt_am";

const querySchema = z.object({
  konto: z.uuid().optional(),
  grund: z.string().trim().max(60).optional(),
  sort: z.enum(["datum", "betrag"]).optional().default("datum"),
  richtung: z.enum(["asc", "desc"]).optional().default("desc"),
});

/** Gruppe gleichartiger Prüffälle (gleicher normalisierter Empfänger). */
interface Mustergruppe {
  schluessel: string;
  empfaenger: string;
  anzahl: number;
  buchung_ids: string[];
}

function normEmpfaenger(value: string | null): string {
  return (value ?? "").toLowerCase().trim();
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    konto: url.searchParams.get("konto") ?? undefined,
    grund: url.searchParams.get("grund") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    richtung: url.searchParams.get("richtung") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Parameter." },
      { status: 422 },
    );
  }
  const { konto, grund, sort, richtung } = parsed.data;

  const supabase = await createClient();
  let query = supabase
    .from("buchung")
    .select(SELECT_FELDER)
    .eq("owner_id", user.id)
    .eq("status", "zur_pruefung")
    .order(sort === "betrag" ? "betrag" : "buchung_datum", {
      ascending: richtung === "asc",
    })
    .limit(1000);

  if (konto) {
    query = query.eq("konto_id", konto);
  }
  if (grund) {
    // pruef_grund ist eine kommaseparierte Liste von Gründen.
    query = query.ilike("pruef_grund", `%${grund}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Prüfliste konnte nicht geladen werden." },
      { status: 500 },
    );
  }

  const faelle = (data ?? []) as Buchung[];

  // Mustergruppierung: gleicher normalisierter Empfänger (>= 2 Fälle).
  const gruppenMap = new Map<string, Mustergruppe>();
  for (const f of faelle) {
    const key = normEmpfaenger(f.empfaenger);
    if (!key) continue;
    const g = gruppenMap.get(key);
    if (g) {
      g.anzahl += 1;
      g.buchung_ids.push(f.id);
    } else {
      gruppenMap.set(key, {
        schluessel: key,
        empfaenger: f.empfaenger ?? "",
        anzahl: 1,
        buchung_ids: [f.id],
      });
    }
  }
  const gruppen = Array.from(gruppenMap.values())
    .filter((g) => g.anzahl >= 2)
    .sort((a, b) => b.anzahl - a.anzahl);

  return NextResponse.json({ data: faelle, gruppen });
}
