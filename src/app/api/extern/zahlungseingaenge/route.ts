// Zahlungsabgleich sellHugo: liefert Geldeingänge von Bank und PayPal, nur lesend.
//
// GET /api/extern/zahlungseingaenge?seit=YYYY-MM-DD
// Schutz: Authorization: Bearer $SELLHUGO_API_KEY. Ohne konfigurierten Schlüssel
// ist der Endpoint zu. Service-Role-Client, da kein Nutzer angemeldet ist; die
// Anwendung ist Single-Tenant, darum ohne owner-Filter. Kreditkarten und
// Ausgaben verlassen die Anwendung nicht.

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEITE = 1000;
const hash = (s: string) => createHash("sha256").update(s).digest();

type Zeile = { id: string; buchung_datum: string; betrag: number | string; verwendungszweck: string | null; empfaenger: string | null; konto: { bezeichnung: string } | { bezeichnung: string }[] | null };

export async function GET(request: Request) {
  const key = process.env.SELLHUGO_API_KEY?.trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!key || !timingSafeEqual(hash(auth), hash(`Bearer ${key}`))) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  const seit = new URL(request.url).searchParams.get("seit");
  if (seit && !/^\d{4}-\d{2}-\d{2}$/.test(seit)) {
    return NextResponse.json({ error: "seit muss YYYY-MM-DD sein." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const zeilen: Zeile[] = [];
    for (let von = 0; ; von += SEITE) {
      let abfrage = supabase
        .from("buchung")
        .select("id, buchung_datum, betrag, verwendungszweck, empfaenger, konto:konto_id!inner(bezeichnung, typ)")
        .gt("betrag", 0)
        .eq("waehrung", "EUR")
        .is("parent_buchung_id", null)
        .in("konto.typ", ["bank", "paypal"])
        .order("buchung_datum")
        .order("id")
        .range(von, von + SEITE - 1);
      if (seit) abfrage = abfrage.gte("buchung_datum", seit);
      const { data, error } = await abfrage;
      if (error) throw error;
      zeilen.push(...((data ?? []) as unknown as Zeile[]));
      if (!data || data.length < SEITE) break;
    }
    const eingaenge = zeilen.map((z) => ({
      id: z.id,
      datum: z.buchung_datum,
      cent: Math.round(Number(z.betrag) * 100),
      text: z.verwendungszweck ?? "",
      zahler: z.empfaenger ?? "",
      konto: (Array.isArray(z.konto) ? z.konto[0] : z.konto)?.bezeichnung ?? "",
    }));
    return NextResponse.json({ eingaenge }, { headers: { "cache-control": "no-store" } });
  } catch {
    // Keine Details nach außen, die Antwort könnte Kontodaten enthalten.
    return NextResponse.json({ error: "Abruf fehlgeschlagen." }, { status: 500 });
  }
}
