// PROJ-9: Jahres-EÜR (§4 Abs.3 EStG) — Berechnung & Jahresabschluss.
//
// GET  ?jahr=YYYY  -> Liefert die EÜR des Wirtschaftsjahres. Ist das Jahr
//                     bereits 'abgeschlossen', wird der eingefrorene Snapshot
//                     zurückgegeben (unveränderlich). Sonst on-the-fly
//                     berechnet. Plus Warnungen (offene Prüffälle,
//                     unklassifizierte Buchungen, Geschäftsbuchungen ohne
//                     Beleg) je Anzahl + Summenwirkung. Bei abgeschlossenem
//                     Jahr zusätzlich Berichtigungshinweis, falls nach dem
//                     Abschluss noch Buchungen verändert/ergänzt wurden.
//
// POST { jahr, bestaetigt }  -> Friert die EÜR als Snapshot ein, setzt
//                     steuerperiode.status='abgeschlossen' (unveränderlich).
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS.
// Validierung mit Zod VOR jedem DB-Zugriff. Deterministisch, keine KI.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { euerJahrSchema, euerAbschlussSchema } from "@/lib/validation/euer";
import {
  berechneEuer,
  wirtschaftsjahrGrenzen,
  type EuerErgebnis,
} from "@/lib/tax/euer";
import type { Buchung, Kategorie } from "@/lib/types";

export const runtime = "nodejs";

const SELECT_BUCHUNG =
  "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund, parent_buchung_id, split_anteil";

const SELECT_KATEGORIE =
  "id, bezeichnung, typ, ust_satz, euer_zeile, elster_kennzahl, aktiv, gueltig_ab";

interface EuerWarnungen {
  offene_pruefaelle: { anzahl: number; summe: number };
  unklassifiziert: { anzahl: number; summe: number };
  ohne_beleg: { anzahl: number; summe: number };
  /** Geschäftliche Buchungen ohne zuordenbare Kategorie. */
  ohne_kategorie: { anzahl: number; summe_einnahmen: number; summe_ausgaben: number };
}

interface EuerSnapshot {
  ergebnis: EuerErgebnis;
  warnungen: EuerWarnungen;
  abgeschlossen_at: string;
}

/** Wirtschaftsjahr-Beginn-Monat aus dem Firmenprofil (Default Kalenderjahr). */
async function ladeWjBeginn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
): Promise<number> {
  const { data } = await supabase
    .from("firmenprofil")
    .select("wirtschaftsjahr_beginn")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();
  const m = (data as { wirtschaftsjahr_beginn?: number } | null)
    ?.wirtschaftsjahr_beginn;
  return typeof m === "number" && m >= 1 && m <= 12 ? m : 1;
}

/** Lädt alle owner-scoped Buchungen eines WJ-Zeitraums (datums-gefiltert). */
async function ladeBuchungen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  von: string,
  bis: string,
): Promise<Buchung[]> {
  const { data, error } = await supabase
    .from("buchung")
    .select(SELECT_BUCHUNG)
    .eq("owner_id", ownerId)
    .gte("buchung_datum", von)
    .lte("buchung_datum", bis)
    .order("buchung_datum", { ascending: true })
    .limit(50000);
  if (error) throw new Error("Buchungen konnten nicht geladen werden.");
  return (data ?? []) as Buchung[];
}

/** Ermittelt die Warnhinweise für ein Wirtschaftsjahr. */
async function ermittleWarnungen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  buchungen: Buchung[],
  ergebnis: EuerErgebnis,
): Promise<EuerWarnungen> {
  const summeAbs = (bs: Buchung[]) =>
    Math.round(bs.reduce((s, b) => s + Math.abs(b.betrag), 0) * 100) / 100;

  // Offene Prüffälle (PROJ-7): status='zur_pruefung' im WJ.
  const pruef = buchungen.filter((b) => b.status === "zur_pruefung");
  // Unklassifiziert: noch 'offen' bzw. ohne Klassifikation.
  const unklass = buchungen.filter(
    (b) => b.status === "offen" || b.klassifikation === null,
  );

  // Geschäftsbuchungen ohne Beleg (PROJ-6 via beleg_buchung).
  const geschaeftlich = buchungen.filter(
    (b) => b.klassifikation === "geschaeftlich",
  );
  let ohneBelegAnzahl = 0;
  let ohneBelegSumme = 0;
  if (geschaeftlich.length > 0) {
    const ids = geschaeftlich.map((b) => b.id);
    const { data: bbData } = await supabase
      .from("beleg_buchung")
      .select("buchung_id")
      .eq("owner_id", ownerId)
      .in("buchung_id", ids)
      .limit(50000);
    const mitBeleg = new Set(
      ((bbData ?? []) as Array<{ buchung_id: string }>).map(
        (r) => r.buchung_id,
      ),
    );
    const ohne = geschaeftlich.filter((b) => !mitBeleg.has(b.id));
    ohneBelegAnzahl = ohne.length;
    ohneBelegSumme = summeAbs(ohne);
  }

  return {
    offene_pruefaelle: { anzahl: pruef.length, summe: summeAbs(pruef) },
    unklassifiziert: { anzahl: unklass.length, summe: summeAbs(unklass) },
    ohne_beleg: { anzahl: ohneBelegAnzahl, summe: ohneBelegSumme },
    ohne_kategorie: ergebnis.ohne_kategorie,
  };
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const jahrParam = new URL(request.url).searchParams.get("jahr");
  const parsed = euerJahrSchema.safeParse({ jahr: jahrParam });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const { jahr } = parsed.data;

  const supabase = await createClient();

  // Bereits abgeschlossenes Jahr → Snapshot (unveränderlich).
  const { data: periode } = await supabase
    .from("steuerperiode")
    .select("id, status, snapshot, abgeschlossen_at")
    .eq("owner_id", user.id)
    .eq("art", "wirtschaftsjahr")
    .eq("jahr", jahr)
    .is("periode", null)
    .limit(1)
    .maybeSingle();

  const wjBeginn = await ladeWjBeginn(supabase, user.id);
  const { von, bis } = wirtschaftsjahrGrenzen(jahr, wjBeginn);

  let buchungen: Buchung[];
  try {
    buchungen = await ladeBuchungen(supabase, user.id, von, bis);
  } catch {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  if (
    periode &&
    (periode as { status: string }).status === "abgeschlossen" &&
    (periode as { snapshot: unknown }).snapshot
  ) {
    const snap = (periode as { snapshot: EuerSnapshot }).snapshot;
    // Berichtigungshinweis: Buchungen nach Abschluss geändert/ergänzt?
    const abgeschlossenAt = (periode as { abgeschlossen_at: string | null })
      .abgeschlossen_at;
    return NextResponse.json({
      jahr,
      abgeschlossen: true,
      abgeschlossen_at: abgeschlossenAt,
      ergebnis: snap.ergebnis,
      warnungen: snap.warnungen,
      berichtigung_noetig: buchungen.length !== zaehleSnapshotBuchungen(snap),
      hinweis:
        "Dieses Wirtschaftsjahr ist abgeschlossen. Die Zahlen sind als Snapshot fixiert. Spätere Buchungsänderungen erfordern eine explizite Neuberechnung (Berichtigung).",
    });
  }

  const { data: katData, error: katErr } = await supabase
    .from("kategorie")
    .select(SELECT_KATEGORIE)
    .eq("owner_id", user.id)
    .limit(2000);
  if (katErr) {
    return NextResponse.json(
      { error: "Kategorien konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const kategorien = (katData ?? []) as Kategorie[];

  const ergebnis = berechneEuer(buchungen, kategorien, jahr, wjBeginn);
  const warnungen = await ermittleWarnungen(
    supabase,
    user.id,
    buchungen,
    ergebnis,
  );

  return NextResponse.json({
    jahr,
    abgeschlossen: false,
    abgeschlossen_at: null,
    ergebnis,
    warnungen,
    berichtigung_noetig: false,
  });
}

/** Zahl der im Snapshot erfassten Buchungen (für Berichtigungshinweis). */
function zaehleSnapshotBuchungen(snap: EuerSnapshot): number {
  const e = snap.ergebnis;
  const g = (arr: EuerErgebnis["betriebseinnahmen"]) =>
    arr.reduce((s, x) => s + x.anzahl, 0);
  return g(e.betriebseinnahmen) + g(e.betriebsausgaben) + e.ohne_kategorie.anzahl;
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

  const parsed = euerAbschlussSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const { jahr } = parsed.data;

  const supabase = await createClient();

  // Bereits abgeschlossen? Dann nicht erneut einfrieren (unveränderlich).
  const { data: vorhanden } = await supabase
    .from("steuerperiode")
    .select("id, status")
    .eq("owner_id", user.id)
    .eq("art", "wirtschaftsjahr")
    .eq("jahr", jahr)
    .is("periode", null)
    .limit(1)
    .maybeSingle();
  if (
    vorhanden &&
    (vorhanden as { status: string }).status === "abgeschlossen"
  ) {
    return NextResponse.json(
      {
        error:
          "Dieses Wirtschaftsjahr ist bereits abgeschlossen und unveränderlich.",
      },
      { status: 409 },
    );
  }

  const wjBeginn = await ladeWjBeginn(supabase, user.id);
  const { von, bis } = wirtschaftsjahrGrenzen(jahr, wjBeginn);

  let buchungen: Buchung[];
  try {
    buchungen = await ladeBuchungen(supabase, user.id, von, bis);
  } catch {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  const { data: katData, error: katErr } = await supabase
    .from("kategorie")
    .select(SELECT_KATEGORIE)
    .eq("owner_id", user.id)
    .limit(2000);
  if (katErr) {
    return NextResponse.json(
      { error: "Kategorien konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const kategorien = (katData ?? []) as Kategorie[];

  const ergebnis = berechneEuer(buchungen, kategorien, jahr, wjBeginn);
  const warnungen = await ermittleWarnungen(
    supabase,
    user.id,
    buchungen,
    ergebnis,
  );
  const abgeschlossenAt = new Date().toISOString();
  const snapshot: EuerSnapshot = {
    ergebnis,
    warnungen,
    abgeschlossen_at: abgeschlossenAt,
  };

  const { error: upsertErr } = await supabase
    .from("steuerperiode")
    .upsert(
      {
        owner_id: user.id,
        art: "wirtschaftsjahr",
        jahr,
        periode: null,
        status: "abgeschlossen",
        snapshot: snapshot as unknown as Record<string, unknown>,
        abgeschlossen_at: abgeschlossenAt,
      },
      { onConflict: "owner_id,art,jahr,periode" },
    );
  if (upsertErr) {
    return NextResponse.json(
      { error: "Jahresabschluss konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    jahr,
    abgeschlossen: true,
    abgeschlossen_at: abgeschlossenAt,
    ergebnis,
    warnungen,
  });
}
