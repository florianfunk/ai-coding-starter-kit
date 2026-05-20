// PROJ-14: Bulk-Kategoriewechsel. Setzt für viele Buchungen gleichzeitig
// eine Kategorie + die abgeleiteten Steuer-Felder (Klassifikation/USt/
// Steuerrelevant — Auto-Konsistenz wie beim Einzel-PATCH) + Status =
// "manuell_bestaetigt", damit die Re-Klassifizierung das nicht
// überschreibt.
//
// Workflow:
//   1) Validierung (Zod, max 500 IDs)
//   2) Kategorie laden (Owner-Match, sonst 404)
//   3) Buchungen vorher laden (Snapshot für Audit + Sicherstellen, dass
//      jede ID dem Owner gehört — Supabase liefert die fremden gar nicht
//      erst zurück, aber wir vergleichen die Trefferzahl)
//   4) Bulk-Update via UPDATE ... WHERE id IN (...)
//   5) Audit-Einträge in einem INSERT-Schwung
//
// Auth: getApiUser. RLS deckt zusätzlich ab.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { bulkKategorieSchema } from "@/lib/validation/buchungen-bulk";
import type { BuchungStatus, KategorieTyp, Klassifikation } from "@/lib/types";

interface BuchungVorher {
  id: string;
  kategorie_id: string | null;
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  ust_satz: number | null;
  status: BuchungStatus;
}

export interface BulkKategorieResponse {
  /** Wie viele Buchungen tatsächlich aktualisiert wurden. */
  aktualisiert: number;
  /** IDs, die im Request waren, aber nicht zum User gehören oder fehlen. */
  uebersprungen: string[];
  /** Neue Kategorie zur Bestätigung im UI. */
  kategorie: { id: string; bezeichnung: string; typ: KategorieTyp };
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
  const parsed = bulkKategorieSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen" },
      { status: 422 },
    );
  }
  const { ids, kategorie_id } = parsed.data;
  const supabase = await createClient();

  // 1) Kategorie laden — Auto-Konsistenz braucht Typ + USt-Satz.
  const { data: katData, error: katErr } = await supabase
    .from("kategorie")
    .select("id, bezeichnung, typ, ust_satz")
    .eq("owner_id", user.id)
    .eq("id", kategorie_id)
    .limit(1)
    .maybeSingle();
  if (katErr) {
    return NextResponse.json({ error: "Kategorie-Ladefehler." }, { status: 500 });
  }
  if (!katData) {
    return NextResponse.json(
      { error: "Kategorie nicht gefunden." },
      { status: 404 },
    );
  }
  const kat = katData as {
    id: string;
    bezeichnung: string;
    typ: KategorieTyp;
    ust_satz: number | null;
  };

  // 2) Vorher-Snapshot — gleichzeitig Owner-Filter (RLS würde reichen,
  //    aber wir wollen die "übersprungen"-Liste melden können).
  const { data: vorherData, error: vorherErr } = await supabase
    .from("buchung")
    .select("id, kategorie_id, klassifikation, steuerrelevant, ust_satz, status")
    .eq("owner_id", user.id)
    .in("id", ids);
  if (vorherErr) {
    return NextResponse.json(
      { error: "Vorher-Snapshot fehlgeschlagen: " + vorherErr.message },
      { status: 500 },
    );
  }
  const vorher = (vorherData ?? []) as BuchungVorher[];
  const gefunden = new Set(vorher.map((b) => b.id));
  const uebersprungen = ids.filter((id) => !gefunden.has(id));

  if (vorher.length === 0) {
    return NextResponse.json({
      aktualisiert: 0,
      uebersprungen,
      kategorie: { id: kat.id, bezeichnung: kat.bezeichnung, typ: kat.typ },
    } satisfies BulkKategorieResponse);
  }

  // 3) Auto-Konsistenz aus Kategorie-Typ (gleiche Regeln wie Einzel-PATCH).
  const updates: Record<string, unknown> = {
    kategorie_id: kat.id,
    status: "manuell_bestaetigt",
    quelle: "manuell",
    pruef_grund: null,
  };
  if (kat.typ === "privat") updates.klassifikation = "privat";
  else if (kat.typ === "neutral") updates.klassifikation = "neutral";
  else if (kat.typ === "einnahme" || kat.typ === "ausgabe")
    updates.klassifikation = "geschaeftlich";
  updates.steuerrelevant = kat.typ === "einnahme" || kat.typ === "ausgabe";
  updates.ust_satz =
    kat.typ === "privat" || kat.typ === "neutral" ? null : kat.ust_satz;

  // 4) Bulk-UPDATE.
  const { data: nachherData, error: updErr } = await supabase
    .from("buchung")
    .update(updates)
    .eq("owner_id", user.id)
    .in("id", Array.from(gefunden))
    .select("id, kategorie_id, klassifikation, steuerrelevant, ust_satz, status");
  if (updErr) {
    return NextResponse.json(
      { error: "Bulk-Update fehlgeschlagen: " + updErr.message },
      { status: 500 },
    );
  }
  const nachher = (nachherData ?? []) as BuchungVorher[];
  const nachherMap = new Map(nachher.map((b) => [b.id, b]));

  // 5) Audit-Einträge — einer pro Buchung, in einem INSERT.
  const auditRows = vorher.map((v) => ({
    owner_id: user.id,
    entitaet: "buchung",
    entitaet_id: v.id,
    aktion: "bulk_kategorie_gesetzt",
    quelle: "nutzer",
    details: {
      vorher: v,
      nachher: nachherMap.get(v.id) ?? null,
      kategorie: { id: kat.id, bezeichnung: kat.bezeichnung, typ: kat.typ },
      bulk_size: vorher.length,
    },
  }));
  // Fehler beim Audit nicht den ganzen Call zerschießen — der Schreibvorgang
  // war erfolgreich, Audit ist sekundär.
  await supabase.from("audit_eintrag").insert(auditRows);

  const payload: BulkKategorieResponse = {
    aktualisiert: nachher.length,
    uebersprungen,
    kategorie: { id: kat.id, bezeichnung: kat.bezeichnung, typ: kat.typ },
  };
  return NextResponse.json(payload);
}
