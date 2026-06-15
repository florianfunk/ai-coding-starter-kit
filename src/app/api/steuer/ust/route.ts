// PROJ-8: USt-Voranmeldung — Berechnung & Abschluss.
//
// GET  ?jahr=&periode=  -> Berechnet die Periode deterministisch aus den
//        AKTUELLEN Buchungen. Ist die Periode bereits abgeschlossen, wird
//        der eingefrorene Snapshot geliefert (unveränderlich) PLUS ein
//        Berichtigungshinweis, falls seither relevante Buchungen
//        dazugekommen sind. Liefert zusätzlich die Jahresübersicht aller
//        Perioden + Warnungen (offene Prüffälle, Geschäftsbuchungen ohne
//        Beleg, unklassifizierte) mit Anzahl.
//
// POST  {jahr,periode}  -> Friert den Snapshot ein, setzt
//        steuerperiode.status='abgeschlossen'. Bereits abgeschlossene
//        Perioden werden NIE still überschrieben.
//
// DELETE {jahr,periode} -> Macht einen Abschluss rückgängig
//        (Wiedereröffnen): status zurück auf 'offen', verwirft den
//        eingefrorenen Snapshot. Nur erlaubt, wenn die Periode aktuell
//        abgeschlossen ist. Buchungen bleiben unberührt.
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS. Zod.
// Rein deterministisch — keine KI in der Endsumme.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  ustPeriodeQuerySchema,
  ustAbschlussSchema,
} from "@/lib/validation/ustva";
import { berechneUstVa, type UstBuchung } from "@/lib/tax/ust";
import { ladeAlle } from "@/lib/supabase/fetch-all";
import {
  ustVaPerioden,
  ustVaPeriode,
  periodeFuerDatum,
  type UstRhythmus,
} from "@/lib/tax/perioden";
import type { Firmenprofil, UstStatus } from "@/lib/types";

export const runtime = "nodejs";

interface ProfilRow {
  ust_status: UstStatus;
  ust_va_rhythmus: Firmenprofil["ust_va_rhythmus"];
}

interface BuchungRow {
  id: string;
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
  klassifikation: UstBuchung["klassifikation"];
  steuerrelevant: boolean | null;
  ust_satz: number | null;
  status: string;
}

const SELECT_BUCHUNG =
  "id, buchung_datum, betrag, verwendungszweck, empfaenger, klassifikation, steuerrelevant, ust_satz, status";

/** Rhythmus → kanonische perioden.ts-Variante. */
function rhythmus(p: ProfilRow): UstRhythmus {
  return p.ust_va_rhythmus === "quartalsweise"
    ? "quartalsweise"
    : p.ust_va_rhythmus === "jaehrlich"
      ? "jaehrlich"
      : "monatlich";
}

async function ladeProfil(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
): Promise<ProfilRow | null> {
  const { data } = await supabase
    .from("firmenprofil")
    .select("ust_status, ust_va_rhythmus")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();
  return (data as ProfilRow | null) ?? null;
}

/** Belegte Buchungs-IDs (mind. eine beleg_buchung-Zuordnung) als Set. */
async function ladeBelegteIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
): Promise<Set<string>> {
  const { data } = await ladeAlle((von, bisIdx) =>
    supabase
      .from("beleg_buchung")
      .select("buchung_id")
      .eq("owner_id", ownerId)
      .order("buchung_id", { ascending: true })
      .order("id", { ascending: true })
      .range(von, bisIdx),
  );
  const s = new Set<string>();
  for (const r of (data ?? []) as Array<{ buchung_id: string }>) {
    s.add(r.buchung_id);
  }
  return s;
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = ustPeriodeQuerySchema.safeParse({
    jahr: url.searchParams.get("jahr"),
    periode: url.searchParams.get("periode"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const { jahr, periode } = parsed.data;
  const supabase = await createClient();

  const profil = await ladeProfil(supabase, user.id);
  if (!profil) {
    return NextResponse.json(
      {
        error:
          "Kein Firmenprofil gefunden. Bitte zuerst Firma & Steuerprofil pflegen.",
      },
      { status: 409 },
    );
  }
  const rhy = rhythmus(profil);

  const periodenListe = ustVaPerioden(jahr, rhy);
  const aktuell = ustVaPeriode(jahr, periode, rhy);
  if (!aktuell) {
    return NextResponse.json(
      { error: "Ungültige Periode für den eingestellten Rhythmus." },
      { status: 422 },
    );
  }

  // Buchungen des Kalenderjahres laden (Periodenzuordnung in perioden.ts).
  // Vollständig paginiert — PostgREST deckelt sonst bei 1000 Zeilen und
  // verfälscht jede Aggregation. Stabile Sortierung via id (Pflicht für range).
  const { data: buData, error: buErr } = await ladeAlle((von, bisIdx) =>
    supabase
      .from("buchung")
      .select(SELECT_BUCHUNG)
      .eq("owner_id", user.id)
      .gte("buchung_datum", `${jahr}-01-01`)
      .lte("buchung_datum", `${jahr}-12-31`)
      .order("id", { ascending: true })
      .range(von, bisIdx),
  );
  if (buErr) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const alleBuchungen = (buData ?? []) as BuchungRow[];
  const belegteIds = await ladeBelegteIds(supabase, user.id);

  // Buchungen der angefragten Periode (Datum-Zuordnung; unklares Datum →
  // Ausschluss + Warnung).
  let datumUnklar = 0;
  const periodenBuchungen: UstBuchung[] = [];
  for (const b of alleBuchungen) {
    const p = periodeFuerDatum(b.buchung_datum, jahr, rhy);
    if (!p) {
      datumUnklar++;
      continue;
    }
    if (p.periode !== periode) continue;
    periodenBuchungen.push({
      id: b.id,
      buchung_datum: b.buchung_datum,
      betrag: b.betrag,
      klassifikation: b.klassifikation,
      steuerrelevant: b.steuerrelevant,
      ust_satz: b.ust_satz,
      belegt: belegteIds.has(b.id),
    });
  }

  const berechnung = berechneUstVa(
    periodenBuchungen,
    jahr,
    periode,
    profil.ust_status,
  );

  // Warnungen für die Periode.
  const periodenIds = new Set(periodenBuchungen.map((b) => b.id));
  let offenePruefung = 0;
  let unklassifiziert = 0;
  let geschaeftOhneBeleg = 0;
  for (const b of alleBuchungen) {
    if (!periodenIds.has(b.id)) continue;
    if (b.status === "zur_pruefung") offenePruefung++;
    if (b.status === "offen" || b.klassifikation === "unklar") {
      unklassifiziert++;
    }
    if (
      b.klassifikation === "geschaeftlich" &&
      b.steuerrelevant === true &&
      !belegteIds.has(b.id)
    ) {
      geschaeftOhneBeleg++;
    }
  }

  // Bereits gespeicherte Steuerperiode (Snapshot/Status)?
  const { data: periodeRow } = await supabase
    .from("steuerperiode")
    .select("id, status, snapshot, abgeschlossen_at")
    .eq("owner_id", user.id)
    .eq("art", "ust_va")
    .eq("jahr", jahr)
    .eq("periode", periode)
    .limit(1)
    .maybeSingle();

  const istAbgeschlossen =
    periodeRow != null &&
    (periodeRow as { status: string }).status === "abgeschlossen";

  let snapshot: unknown = null;
  let berichtigungshinweis: string | null = null;
  if (istAbgeschlossen && periodeRow) {
    snapshot = (periodeRow as { snapshot: unknown }).snapshot;
    const snap = snapshot as { summe?: { zahllast?: number } } | null;
    const snapZahllast = snap?.summe?.zahllast ?? null;
    if (
      snapZahllast !== null &&
      Math.abs(snapZahllast - berechnung.summe.zahllast) > 0.005
    ) {
      berichtigungshinweis =
        "Seit dem Abschluss haben sich die Zahlen geändert (z. B. nachträgliche Buchungen). Der Abschluss-Snapshot bleibt unverändert — eine Korrektur erfordert eine Berichtigung.";
    }
  }

  // Drill-down-Detail je einbezogener Buchung (id → Anzeigefelder).
  const buchungDetails: Record<
    string,
    {
      buchung_datum: string;
      betrag: number;
      verwendungszweck: string | null;
      empfaenger: string | null;
      belegt: boolean;
    }
  > = {};
  for (const b of alleBuchungen) {
    if (!periodenIds.has(b.id)) continue;
    buchungDetails[b.id] = {
      buchung_datum: b.buchung_datum,
      betrag: b.betrag,
      verwendungszweck: b.verwendungszweck,
      empfaenger: b.empfaenger,
      belegt: belegteIds.has(b.id),
    };
  }

  return NextResponse.json({
    jahr,
    periode,
    periode_label: aktuell.label,
    rhythmus: rhy,
    buchung_details: buchungDetails,
    status: periodeRow
      ? (periodeRow as { status: string }).status
      : "offen",
    abgeschlossen_at: periodeRow
      ? ((periodeRow as { abgeschlossen_at: string | null }).abgeschlossen_at ??
        null)
      : null,
    // Bei Abschluss: eingefrorener Snapshot ist die verbindliche Wahrheit.
    berechnung: istAbgeschlossen && snapshot ? snapshot : berechnung,
    live_berechnung: berechnung,
    berichtigungshinweis,
    jahresuebersicht: periodenListe.map((p) => ({
      periode: p.periode,
      label: p.label,
      start: p.start,
      ende: p.ende,
    })),
    warnungen: {
      offene_pruefung: offenePruefung,
      unklassifiziert,
      geschaeft_ohne_beleg: geschaeftOhneBeleg,
      vorsteuer_ohne_beleg: berechnung.diagnostik.vorsteuer_ohne_beleg_anzahl,
      datum_unklar: datumUnklar,
      ohne_ust_satz: berechnung.diagnostik.ohne_ust_satz_anzahl,
    },
  });
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
  const parsed = ustAbschlussSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const { jahr, periode } = parsed.data;
  const supabase = await createClient();

  const profil = await ladeProfil(supabase, user.id);
  if (!profil) {
    return NextResponse.json(
      { error: "Kein Firmenprofil gefunden." },
      { status: 409 },
    );
  }
  const rhy = rhythmus(profil);
  const aktuell = ustVaPeriode(jahr, periode, rhy);
  if (!aktuell) {
    return NextResponse.json(
      { error: "Ungültige Periode für den eingestellten Rhythmus." },
      { status: 422 },
    );
  }

  // Bereits abgeschlossen? → NICHT still überschreiben.
  const { data: vorhanden } = await supabase
    .from("steuerperiode")
    .select("id, status")
    .eq("owner_id", user.id)
    .eq("art", "ust_va")
    .eq("jahr", jahr)
    .eq("periode", periode)
    .limit(1)
    .maybeSingle();
  if (
    vorhanden &&
    (vorhanden as { status: string }).status === "abgeschlossen"
  ) {
    return NextResponse.json(
      {
        error:
          "Diese Periode ist bereits abgeschlossen. Der Snapshot ist unveränderlich; Korrekturen nur per Berichtigung.",
      },
      { status: 409 },
    );
  }

  // Snapshot deterministisch aus aktuellen Daten bilden.
  // Vollständig paginiert — PostgREST deckelt sonst bei 1000 Zeilen und der
  // eingefrorene Snapshot wäre falsch. Stabile Sortierung via id (range-Pflicht).
  const { data: buData, error: buErr } = await ladeAlle((von, bisIdx) =>
    supabase
      .from("buchung")
      .select(SELECT_BUCHUNG)
      .eq("owner_id", user.id)
      .gte("buchung_datum", `${jahr}-01-01`)
      .lte("buchung_datum", `${jahr}-12-31`)
      .order("id", { ascending: true })
      .range(von, bisIdx),
  );
  if (buErr) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const alleBuchungen = (buData ?? []) as BuchungRow[];
  const belegteIds = await ladeBelegteIds(supabase, user.id);

  const periodenBuchungen: UstBuchung[] = [];
  for (const b of alleBuchungen) {
    const p = periodeFuerDatum(b.buchung_datum, jahr, rhy);
    if (!p || p.periode !== periode) continue;
    periodenBuchungen.push({
      id: b.id,
      buchung_datum: b.buchung_datum,
      betrag: b.betrag,
      klassifikation: b.klassifikation,
      steuerrelevant: b.steuerrelevant,
      ust_satz: b.ust_satz,
      belegt: belegteIds.has(b.id),
    });
  }
  const berechnung = berechneUstVa(
    periodenBuchungen,
    jahr,
    periode,
    profil.ust_status,
  );

  const snapshot = {
    ...berechnung,
    abgeschlossen_am: new Date().toISOString(),
  } as unknown as Record<string, unknown>;

  // Upsert: existierende offene/geprüfte Periode → abschließen, sonst neu.
  if (vorhanden) {
    const { error: updErr } = await supabase
      .from("steuerperiode")
      .update({
        status: "abgeschlossen",
        snapshot,
        abgeschlossen_at: new Date().toISOString(),
      })
      .eq("id", (vorhanden as { id: string }).id)
      .eq("owner_id", user.id)
      .neq("status", "abgeschlossen");
    if (updErr) {
      return NextResponse.json(
        { error: "Periode konnte nicht abgeschlossen werden." },
        { status: 500 },
      );
    }
  } else {
    const { error: insErr } = await supabase.from("steuerperiode").insert({
      owner_id: user.id,
      art: "ust_va",
      jahr,
      periode,
      status: "abgeschlossen",
      snapshot,
      abgeschlossen_at: new Date().toISOString(),
    });
    if (insErr) {
      return NextResponse.json(
        { error: "Periode konnte nicht angelegt werden." },
        { status: 500 },
      );
    }
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    entitaet: "steuerperiode",
    entitaet_id: null,
    aktion: "ust_va_abgeschlossen",
    quelle: "nutzer",
    details: {
      jahr,
      periode,
      label: aktuell.label,
      zahllast: berechnung.summe.zahllast,
    },
  });

  return NextResponse.json({ ok: true, jahr, periode, snapshot });
}

export async function DELETE(request: Request) {
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
  const parsed = ustAbschlussSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const { jahr, periode } = parsed.data;
  const supabase = await createClient();

  // Periode muss existieren und abgeschlossen sein.
  const { data: vorhanden } = await supabase
    .from("steuerperiode")
    .select("id, status")
    .eq("owner_id", user.id)
    .eq("art", "ust_va")
    .eq("jahr", jahr)
    .eq("periode", periode)
    .limit(1)
    .maybeSingle();
  if (
    !vorhanden ||
    (vorhanden as { status: string }).status !== "abgeschlossen"
  ) {
    return NextResponse.json(
      {
        error:
          "Diese Periode ist nicht abgeschlossen — es gibt nichts rückgängig zu machen.",
      },
      { status: 409 },
    );
  }

  // Abschluss zurücknehmen: Status auf 'offen', Snapshot verwerfen.
  // .eq("status","abgeschlossen") schützt vor Race-Conditions.
  const { error: updErr } = await supabase
    .from("steuerperiode")
    .update({
      status: "offen",
      snapshot: null,
      abgeschlossen_at: null,
    })
    .eq("id", (vorhanden as { id: string }).id)
    .eq("owner_id", user.id)
    .eq("status", "abgeschlossen");
  if (updErr) {
    return NextResponse.json(
      { error: "Abschluss konnte nicht rückgängig gemacht werden." },
      { status: 500 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    entitaet: "steuerperiode",
    entitaet_id: (vorhanden as { id: string }).id,
    aktion: "ust_va_wiedereroeffnet",
    quelle: "nutzer",
    details: { jahr, periode },
  });

  return NextResponse.json({ ok: true, jahr, periode, status: "offen" });
}
