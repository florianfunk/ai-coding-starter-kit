// PROJ-34: Globale Volltextsuche für die Command-Palette (⌘K v2).
//
// GET /api/suche?q=...
//   → owner-scoped Top-N Buchungen (Match auf empfaenger /
//     empfaenger_normalisiert / verwendungszweck / exakter Betrag, wenn q eine
//     Zahl ist) und Top-N distinct Empfänger.
//
// Sicherheit:
//   - Auth Pflicht (getApiUser → 401).
//   - owner_id-Filter zusätzlich zur RLS (Defense-in-Depth).
//   - q < 2 Zeichen → sofort leere Antwort, KEIN DB-Query (kein teurer Scan).
//   - ILIKE-Pattern parametrisiert über den Supabase-Client; Wildcards in der
//     Eingabe werden escaped (siehe lib/suche/suche.ts). Keine Injection.
//   - Alle Queries .limit()-begrenzt — kein unbeschränkter Scan.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  normalisiereQuery,
  istSuchbar,
  erkenneBetrag,
  ilikePattern,
  mapeBuchung,
  aggregiereEmpfaenger,
  leereAntwort,
  SUCHE_LIMIT,
  type BuchungRow,
  type EmpfaengerRow,
  type SucheResponse,
} from "@/lib/suche/suche";

export const runtime = "nodejs";

// Mehr Empfänger-Rows laden als am Ende ausgegeben werden, damit die distinct-
// Aggregation auf eine sinnvolle Menge zugreift, ohne unbeschränkt zu scannen.
const EMPFAENGER_FETCH_LIMIT = 100;

export async function GET(request: Request): Promise<Response> {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = normalisiereQuery(url.searchParams.get("q"));

  // Mindest-Querylänge: ohne teuren Query sofort leer antworten.
  if (!istSuchbar(q)) {
    return NextResponse.json(leereAntwort() satisfies SucheResponse);
  }

  const supabase = await createClient();
  const pattern = ilikePattern(q);
  const betrag = erkenneBetrag(q);

  // --- Buchungen ---------------------------------------------------------
  // .or() kombiniert die Text-Matches; bei numerischer Eingabe zusätzlich der
  // exakte Betrag (positiv UND negativ, weil Ausgaben negativ gespeichert
  // sind). Der Pattern-Wert ist escaped → kein PostgREST-Filter-Breakout.
  const orFilter = [
    `empfaenger.ilike.${pattern}`,
    `empfaenger_normalisiert.ilike.${pattern}`,
    `verwendungszweck.ilike.${pattern}`,
  ];
  if (betrag !== null) {
    orFilter.push(`betrag.eq.${betrag}`);
    orFilter.push(`betrag.eq.${-betrag}`);
  }

  const { data: buchungenData, error: buchungenErr } = await supabase
    .from("buchung")
    .select("id, buchung_datum, betrag, empfaenger, verwendungszweck")
    .eq("owner_id", user.id)
    .or(orFilter.join(","))
    .order("buchung_datum", { ascending: false })
    .limit(SUCHE_LIMIT);

  if (buchungenErr) {
    return NextResponse.json(
      { error: "Suche fehlgeschlagen." },
      { status: 500 },
    );
  }

  // --- Empfänger (distinct) ----------------------------------------------
  // Eigene, schlanke Query: nur die beiden Empfänger-Spalten, mehr Rows als
  // ausgegeben werden, damit die distinct-Aggregation greift.
  const { data: empfData, error: empfErr } = await supabase
    .from("buchung")
    .select("empfaenger, empfaenger_normalisiert")
    .eq("owner_id", user.id)
    .or(`empfaenger.ilike.${pattern},empfaenger_normalisiert.ilike.${pattern}`)
    .order("buchung_datum", { ascending: false })
    .limit(EMPFAENGER_FETCH_LIMIT);

  if (empfErr) {
    return NextResponse.json(
      { error: "Suche fehlgeschlagen." },
      { status: 500 },
    );
  }

  const antwort: SucheResponse = {
    buchungen: ((buchungenData ?? []) as BuchungRow[]).map(mapeBuchung),
    empfaenger: aggregiereEmpfaenger(
      (empfData ?? []) as EmpfaengerRow[],
      SUCHE_LIMIT,
    ),
  };

  return NextResponse.json(antwort);
}
