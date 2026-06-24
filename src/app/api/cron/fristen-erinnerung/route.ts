// PROJ-32 (AC4): Cron-Endpoint für die USt-VA-Fristen-Erinnerung.
//
// GET /api/cron/fristen-erinnerung
// Schutz: Vercel-Standard — Authorization: Bearer $CRON_SECRET. Ohne gültiges
// Secret → 401. Mit gültigem Secret: Profil/Frist laden, fällige Stufe
// bestimmen, (Opt-in & Mailadresse) → versenden, Versand-Log schreiben,
// JSON-Summary zurückgeben.
//
// WICHTIG: Ohne RESEND_API_KEY versendet der Mail-Adapter NICHTS (no-op) — der
// Lauf bleibt fehlerfrei. Service-Role-Client, da der Cron keine Nutzer-Session
// hat; owner-Scoping erfolgt explizit im Runner.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { laufFristenErinnerung } from "@/lib/fristen/cron-runner";

export const runtime = "nodejs";
// Cron läuft serverseitig, nie cachen.
export const dynamic = "force-dynamic";

function heuteIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  );
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");

  // Strikter Schutz: Ohne konfiguriertes Secret ist der Endpoint zu (nicht
  // versehentlich offen). Mit Secret muss der Bearer exakt passen.
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const summary = await laufFristenErinnerung({
      supabase,
      heute: heuteIso(),
      appUrl: appUrl(),
    });
    return NextResponse.json(summary);
  } catch (e) {
    console.error("[cron fristen-erinnerung] Fehler:", e);
    return NextResponse.json(
      { error: "Lauf fehlgeschlagen." },
      { status: 500 },
    );
  }
}
