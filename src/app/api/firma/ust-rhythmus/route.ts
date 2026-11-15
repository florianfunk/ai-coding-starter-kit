import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { ladeAlle } from "@/lib/supabase/fetch-all";
import { ustVaPeriode, type UstRhythmusProfil } from "@/lib/tax/perioden";
import { ustRhythmusWechselSchema } from "@/lib/validation/ust-rhythmus";

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const parsed = ustRhythmusWechselSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  const supabase = await createClient();
  const { data: profil, error: profilFehler } = await supabase.from("firmenprofil")
    .select("ust_va_rhythmus, ust_va_rhythmus_vorher, rhythmus_gueltig_ab")
    .eq("owner_id", user.id).maybeSingle();
  if (profilFehler) return NextResponse.json({ error: "Steuerprofil konnte nicht geladen werden." }, { status: 500 });
  if (!profil) return NextResponse.json({ error: "Bitte zuerst ein Steuerprofil anlegen." }, { status: 409 });
  const ersterWechsel = profil.ust_va_rhythmus === "quartalsweise" && !profil.ust_va_rhythmus_vorher;
  const terminKorrektur = profil.ust_va_rhythmus === "monatlich" && profil.ust_va_rhythmus_vorher === "quartalsweise";
  if (!ersterWechsel && !terminKorrektur) {
    return NextResponse.json({ error: "Die Umstellung ist nur von quartalsweiser auf monatliche Abgabe möglich." }, { status: 409 });
  }
  const neu: UstRhythmusProfil = {
    ust_va_rhythmus: "monatlich", ust_va_rhythmus_vorher: "quartalsweise",
    rhythmus_gueltig_ab: parsed.data.rhythmus_gueltig_ab,
  };

  // Ein Quartalsabschluss darf durch den Wechsel nicht zum Monatsabschluss werden.
  const { data: abschluesse, error: abschlussFehler } = await ladeAlle<{
    jahr: number; periode: number; snapshot: { zeitraum?: { von: string; bis: string } } | null;
  }>((von, bis) => supabase.from("steuerperiode").select("jahr, periode, snapshot")
    .eq("owner_id", user.id).eq("art", "ust_va").eq("status", "abgeschlossen")
    .order("id", { ascending: true }).range(von, bis));
  if (abschlussFehler) return NextResponse.json({ error: "Bisherige Abschlüsse konnten nicht geprüft werden." }, { status: 500 });
  for (const abschluss of abschluesse ?? []) {
    const alt = ustVaPeriode(abschluss.jahr, abschluss.periode, profil as UstRhythmusProfil);
    const geplant = ustVaPeriode(abschluss.jahr, abschluss.periode, neu);
    const zeitraum = abschluss.snapshot?.zeitraum;
    const von = zeitraum?.von ?? alt?.start;
    const bis = zeitraum?.bis ?? alt?.ende;
    if (!geplant || geplant.start !== von || geplant.ende !== bis) {
      return NextResponse.json({ error: `Ein abgeschlossener Zeitraum ${abschluss.jahr} liegt ab dem gewählten Wechseltermin. Bitte den betroffenen Abschluss zuerst bewusst wieder öffnen oder einen späteren Wechseltermin wählen.` }, { status: 409 });
    }
  }

  let update = supabase.from("firmenprofil").update(neu).eq("owner_id", user.id)
    .eq("ust_va_rhythmus", profil.ust_va_rhythmus);
  update = profil.ust_va_rhythmus_vorher
    ? update.eq("ust_va_rhythmus_vorher", profil.ust_va_rhythmus_vorher)
    : update.is("ust_va_rhythmus_vorher", null);
  update = profil.rhythmus_gueltig_ab === null
    ? update.is("rhythmus_gueltig_ab", null)
    : update.eq("rhythmus_gueltig_ab", profil.rhythmus_gueltig_ab);
  const { data, error } = await update.select("ust_va_rhythmus, ust_va_rhythmus_vorher, rhythmus_gueltig_ab").maybeSingle();
  if (error) return NextResponse.json({ error: error.code === "P0001"
    ? "Ein Abschluss oder das Steuerprofil wurde zwischenzeitlich geändert. Bitte neu laden und den Wechseltermin prüfen."
    : "Abgaberhythmus konnte nicht gespeichert werden." }, { status: error.code === "P0001" ? 409 : 500 });
  if (!data) return NextResponse.json({ error: "Das Steuerprofil wurde zwischenzeitlich geändert. Bitte neu laden." }, { status: 409 });
  // Der AFTER-UPDATE-Trigger schreibt das Audit atomar mit der Profiländerung.
  return NextResponse.json({ profil: data });
}
