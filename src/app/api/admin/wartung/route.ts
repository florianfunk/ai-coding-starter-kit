// PROJ-13: Daten-Wartung (irreversible Reset-Aktionen, owner-scoped).
// POST {aktion} ->
//   buchungen_reset     : löscht alle Buchungen (CASCADE räumt beleg_buchung)
//   belege_reset        : löscht alle Belege (CASCADE räumt beleg_buchung)
//   kontenrahmen_reseed : löscht alle Kategorien; Re-Seed danach manuell
//                         über /einstellungen/kontenrahmen.
// Abgeschlossene Steuerperioden/Snapshots werden NICHT angefasst.
// Auth Pflicht (getApiUser). Zod vor DB. RLS ist zweite Verteidigungslinie.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { wartungSchema, type WartungAktion } from "@/lib/validation/admin";

async function zaehle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tabelle: "buchung" | "beleg" | "kategorie",
  ownerId: string,
): Promise<number> {
  const { count } = await supabase
    .from(tabelle)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  return count ?? 0;
}

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

  const parsed = wartungSchema.safeParse(body);
  if (!parsed.success) {
    const erstes = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: erstes
          ? `${erstes.path.join(".") || "Eingabe"}: ${erstes.message}`
          : "Validierung fehlgeschlagen.",
      },
      { status: 422 },
    );
  }

  const aktion: WartungAktion = parsed.data.aktion;
  const supabase = await createClient();

  if (aktion === "buchungen_reset") {
    const betroffen = await zaehle(supabase, "buchung", user.id);
    const { error } = await supabase
      .from("buchung")
      .delete()
      .eq("owner_id", user.id);
    if (error) {
      return NextResponse.json(
        { error: "Buchungen konnten nicht zurückgesetzt werden." },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      betroffen,
      message:
        "Alle Buchungen samt Klassifizierung und Beleg-Zuordnungen wurden gelöscht. Snapshots/Steuerperioden bleiben unberührt.",
    });
  }

  if (aktion === "belege_reset") {
    const betroffen = await zaehle(supabase, "beleg", user.id);
    const { error } = await supabase
      .from("beleg")
      .delete()
      .eq("owner_id", user.id);
    if (error) {
      return NextResponse.json(
        { error: "Belege konnten nicht zurückgesetzt werden." },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      betroffen,
      message:
        "Alle Belege samt Beleg-Zuordnungen wurden gelöscht. Buchungen und Snapshots bleiben unberührt.",
    });
  }

  // kontenrahmen_reseed: nur löschen — Seed-Logik NICHT duplizieren.
  const betroffen = await zaehle(supabase, "kategorie", user.id);
  const { error } = await supabase
    .from("kategorie")
    .delete()
    .eq("owner_id", user.id);
  if (error) {
    return NextResponse.json(
      { error: "Kontenrahmen konnte nicht zurückgesetzt werden." },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    betroffen,
    message:
      "Kontenrahmen geleert. Bitte unter „Einstellungen › Kontenrahmen“ den Standard-Kontenrahmen neu anlegen (Seed).",
  });
}
