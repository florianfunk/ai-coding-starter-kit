import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { steuerZurueckstellungSchema } from "@/lib/validation/steuer-zurueckstellung";

const FELDER = "id, steuer_zurueckgestellt, steuer_zurueckgestellt_grund, steuer_zurueckgestellt_am";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  const parsed = steuerZurueckstellungSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 422 });
  const eingabe = parsed.data;
  const supabase = await createClient();
  const { data: vorher, error: ladeFehler } = await supabase.from("buchung").select(FELDER)
    .eq("owner_id", user.id).eq("id", id).maybeSingle();
  if (ladeFehler) return NextResponse.json({ error: "Buchung konnte nicht geladen werden." }, { status: 500 });
  if (!vorher) return NextResponse.json({ error: "Buchung nicht gefunden." }, { status: 404 });
  const zurueck = eingabe.aktion === "zurueckstellen";
  const grund = zurueck ? eingabe.grund : null;
  // Bereits erreichter Zielzustand: Wiederholte Requests sind ohne neue Audits sicher.
  if (vorher.steuer_zurueckgestellt === zurueck && vorher.steuer_zurueckgestellt_grund === grund) {
    return NextResponse.json({ buchung: vorher, veraendert: false });
  }
  let query = supabase.from("buchung").update({
    steuer_zurueckgestellt: zurueck,
    steuer_zurueckgestellt_grund: grund,
  }).eq("owner_id", user.id).eq("id", id);
  query = eingabe.erwartet_am === null
    ? query.is("steuer_zurueckgestellt_am", null)
    : query.eq("steuer_zurueckgestellt_am", eingabe.erwartet_am);
  // DB-Trigger validiert Perioden/Splits und schreibt den Audit atomar.
  const { data, error } = await query.select(FELDER).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.code === "P0001" ? error.message : "Rückstellung konnte nicht gespeichert werden." },
      { status: error.code === "P0001" ? 409 : 500 });
  }
  if (!data) return NextResponse.json({ error: "Die Buchung wurde inzwischen geändert. Bitte neu laden." }, { status: 409 });
  return NextResponse.json({ buchung: data, veraendert: true });
}
