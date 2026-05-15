// PROJ-12: Dashboard-Aggregat-API.
//
// GET -> owner-scoped aggregierte Kennzahlen fürs Dashboard:
//        Aktions-Kennzahlen (Prüffälle/fehlende Belege/unklassifiziert),
//        vorläufige Jahres-Kennzahlen, Periodenstatus, letzter
//        Paperless-Sync & Kontoimport sowie ein Aktualitäts-Zeitstempel.
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { ladeDashboardAggregat } from "@/lib/dashboard/load";

export const runtime = "nodejs";

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const supabase = await createClient();
  try {
    const aggregat = await ladeDashboardAggregat(supabase, user.id);
    return NextResponse.json(aggregat);
  } catch {
    return NextResponse.json(
      { error: "Dashboard konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
