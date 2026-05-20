// PROJ-14 — Abo-/Wiederkehr-Radar. Heuristische Erkennung von
// regelmäßigen Zahlungen aus den Buchungsdaten — ohne Schema-Änderung,
// rein über Muster.
//
// Algorithmus (knapp):
//   1) Lade Ausgaben-Buchungen im (großzügig erweiterten) Zeitraum.
//   2) Gruppiere nach normalisiertem Empfänger.
//   3) Für jede Gruppe mit ≥ 3 Buchungen:
//      - Sortiere chronologisch
//      - Berechne Abstände in Tagen, nimm den Median
//      - Klassifiziere Intervall (wöchentlich/monatlich/quartalsweise/jährlich)
//      - Beträge: prüfe Stabilität (relativer Median-Abweichung-Median < 20%)
//      - Aktivität: letzte Zahlung darf nicht älter als 1.5× Intervall sein
//   4) Berechne erwartete Jahresbelastung.
//
// Filter: Zeitraum, Konto, Bereich. Filter wird *vorsichtig* angewendet —
// wir erweitern den Zeitraum nach vorne, um auch Abos mit nur wenigen
// Buchungen im Filterzeitraum zu erkennen (mind. 365 Tage Lookback).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { analyseFilterSchema } from "@/lib/validation/kategorien-analyse";
import { istImBereich } from "@/lib/finanzen/bereich-filter";
import type { BuchungStatus, KategorieTyp, Klassifikation } from "@/lib/types";

interface BuchungRow {
  id: string;
  konto_id: string;
  buchung_datum: string;
  betrag: number;
  empfaenger: string | null;
  klassifikation: Klassifikation | null;
  kategorie_id: string | null;
  status: BuchungStatus;
}

/** Eine einzelne Buchung im Drill-Down eines Wiederkehr-Items. */
export interface WiederkehrendBuchung {
  id: string;
  buchung_datum: string;
  betrag: number;
  konto_id: string;
  konto_bezeichnung: string;
  kategorie_id: string | null;
  kategorie_bezeichnung: string | null;
  kategorie_typ: KategorieTyp | null;
  status: BuchungStatus;
}

export type Intervall = "woechentlich" | "monatlich" | "quartalsweise" | "jaehrlich";

export interface WiederkehrendItem {
  empfaenger: string;
  intervall: Intervall;
  /** Median-Abstand in Tagen — vor allem für Debug-Sicht. */
  intervall_tage: number;
  /** Mittlerer Buchungs-Betrag (Absolutwert). */
  durchschnitt: number;
  /** Geschätzte Jahresbelastung. */
  jahresbelastung: number;
  /** Anzahl gefundener Buchungen im erweiterten Lookback. */
  anzahl: number;
  /** ISO-Datum der ersten / letzten Buchung. */
  erste: string;
  letzte: string;
  /**
   * Heuristisch: zuletzt < 1.5× Intervall her? Dann gilt das Abo als aktiv.
   * Sonst evtl. gekündigt oder pausiert.
   */
  noch_aktiv: boolean;
  /** Konfidenz 0..1 — hoch wenn viele Buchungen + stabiler Betrag. */
  konfidenz: number;
  /**
   * Alle Buchungen, die zu diesem Wiederkehr-Item beitragen — chronologisch
   * sortiert (älteste zuerst), für Drill-Down + Bulk-Aktionen.
   */
  buchungen: WiederkehrendBuchung[];
}

export interface WiederkehrendResponse {
  items: WiederkehrendItem[];
  /** Summe aller geschätzten Jahresbelastungen der aktiven Wiederkehr-Items. */
  jahresbelastung_aktiv: number;
  /** Lookback-Fenster, das tatsächlich abgefragt wurde (Debug). */
  lookback: { von: string; bis: string };
}

const MIN_BUCHUNGEN = 3;
const BETRAG_TOLERANZ = 0.2; // 20% relative Median-Abweichung max
const MIN_LOOKBACK_TAGE = 365;

interface IntervallProfil {
  name: Intervall;
  min: number;
  max: number;
  proJahr: number;
}
const INTERVALL_PROFILE: IntervallProfil[] = [
  { name: "woechentlich", min: 5, max: 10, proJahr: 52 },
  { name: "monatlich", min: 25, max: 35, proJahr: 12 },
  { name: "quartalsweise", min: 80, max: 100, proJahr: 4 },
  { name: "jaehrlich", min: 330, max: 400, proJahr: 1 },
];

function normEmpfaenger(s: string | null): string {
  if (!s) return "";
  return s
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[\.,;:]+$/g, "");
}

function median(zahlen: number[]): number {
  if (zahlen.length === 0) return 0;
  const sortiert = [...zahlen].sort((a, b) => a - b);
  const m = Math.floor(sortiert.length / 2);
  return sortiert.length % 2
    ? sortiert[m]
    : (sortiert[m - 1] + sortiert[m]) / 2;
}

function tageZwischen(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((db - da) / (24 * 60 * 60 * 1000));
}

function klassifiziereIntervall(tage: number): IntervallProfil | null {
  return INTERVALL_PROFILE.find((p) => tage >= p.min && tage <= p.max) ?? null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = analyseFilterSchema.safeParse({
    jahr: url.searchParams.get("jahr") ?? undefined,
    von: url.searchParams.get("von") ?? undefined,
    bis: url.searchParams.get("bis") ?? undefined,
    konto_id: url.searchParams.get("konto_id") ?? undefined,
    bereich: url.searchParams.get("bereich") ?? undefined,
    nur_steuerrelevant: url.searchParams.get("nur_steuerrelevant") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültiger Filter" },
      { status: 422 },
    );
  }
  const filter = parsed.data;
  const supabase = await createClient();

  // Lookback-Fenster: mindestens 365 Tage vor dem `bis`-Datum, damit auch
  // jährliche Abos erkennbar werden, selbst wenn der Filterzeitraum nur
  // ein Monat ist.
  const bis =
    filter.bis ?? (filter.jahr ? `${filter.jahr}-12-31` : isoHeute());
  const filterVon = filter.von ?? (filter.jahr ? `${filter.jahr}-01-01` : null);
  const lookbackStart = new Date(bis);
  lookbackStart.setDate(lookbackStart.getDate() - MIN_LOOKBACK_TAGE);
  const lookbackVon = filterVon && filterVon < toIso(lookbackStart)
    ? filterVon
    : toIso(lookbackStart);

  let q = supabase
    .from("buchung")
    .select(
      "id, konto_id, buchung_datum, betrag, empfaenger, klassifikation, kategorie_id, status",
    )
    .eq("owner_id", user.id)
    .gte("buchung_datum", lookbackVon)
    .lte("buchung_datum", bis)
    .order("buchung_datum", { ascending: true })
    .limit(20000);
  if (filter.konto_id) q = q.eq("konto_id", filter.konto_id);

  const { data: bData, error: bErr } = await q;
  if (bErr) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  // Stammdaten: Kategorien (Typ + Bezeichnung für UI) und Konten parallel.
  const [{ data: kData }, { data: kontoData }] = await Promise.all([
    supabase
      .from("kategorie")
      .select("id, bezeichnung, typ")
      .eq("owner_id", user.id),
    supabase
      .from("konto")
      .select("id, bezeichnung")
      .eq("owner_id", user.id),
  ]);
  const katMap = new Map<
    string,
    { bezeichnung: string; typ: KategorieTyp }
  >(
    ((kData ?? []) as Array<{
      id: string;
      bezeichnung: string;
      typ: KategorieTyp;
    }>).map((k) => [k.id, { bezeichnung: k.bezeichnung, typ: k.typ }]),
  );
  const kontoMap = new Map<string, string>(
    ((kontoData ?? []) as Array<{ id: string; bezeichnung: string }>).map(
      (k) => [k.id, k.bezeichnung],
    ),
  );

  // Nur Ausgaben + Bereichs-Filter.
  const ausgaben = ((bData ?? []) as BuchungRow[]).filter((b) => {
    const katInfo = b.kategorie_id ? katMap.get(b.kategorie_id) : undefined;
    if (
      !istImBereich(
        {
          klassifikation: b.klassifikation,
          kategorieTyp: katInfo?.typ ?? null,
        },
        filter.bereich,
      )
    ) {
      return false;
    }
    if (katInfo?.typ === "einnahme") return false;
    if (Number(b.betrag) > 0 && !katInfo) return false; // Plus ohne Kategorie → Einnahme-Fallback
    return Number(b.betrag) !== 0;
  });

  // Gruppierung nach normalisiertem Empfänger.
  const gruppen = new Map<string, BuchungRow[]>();
  for (const b of ausgaben) {
    const key = normEmpfaenger(b.empfaenger);
    if (!key) continue; // ohne Empfänger keine Wiederkehr-Aussage möglich
    const arr = gruppen.get(key) ?? [];
    arr.push(b);
    gruppen.set(key, arr);
  }

  const items: WiederkehrendItem[] = [];
  const heute = new Date();

  for (const [, buchungen] of gruppen) {
    if (buchungen.length < MIN_BUCHUNGEN) continue;
    buchungen.sort((a, b) => a.buchung_datum.localeCompare(b.buchung_datum));

    // Intervall-Median berechnen
    const abstaende: number[] = [];
    for (let i = 1; i < buchungen.length; i++) {
      abstaende.push(
        tageZwischen(buchungen[i - 1].buchung_datum, buchungen[i].buchung_datum),
      );
    }
    const intervallTage = median(abstaende);
    const profil = klassifiziereIntervall(intervallTage);
    if (!profil) continue; // kein erkennbarer Rhythmus

    // Beträge: Stabilitäts-Check über Median-Abweichung
    const betraege = buchungen.map((b) => Math.abs(Number(b.betrag) || 0));
    const betragMedian = median(betraege);
    if (betragMedian === 0) continue;
    const relAbw =
      median(betraege.map((b) => Math.abs(b - betragMedian) / betragMedian));
    if (relAbw > BETRAG_TOLERANZ) continue;

    // Aktivität: letzte Zahlung < 1.5× Intervall her?
    const letzte = buchungen[buchungen.length - 1].buchung_datum;
    const tageSeitLetzter = tageZwischen(letzte, toIso(heute));
    const nochAktiv = tageSeitLetzter <= profil.max * 1.5;

    // Konfidenz: mehr Buchungen + stabilerer Betrag = höher.
    // (Mind. 0.5 wenn die Erkennung überhaupt griff, max 0.95.)
    const konfidenz = Math.min(
      0.95,
      0.5 +
        Math.min(0.2, (buchungen.length - MIN_BUCHUNGEN) * 0.05) +
        (BETRAG_TOLERANZ - relAbw) * 1.5,
    );

    const buchungenDetail: WiederkehrendBuchung[] = buchungen.map((b) => {
      const k = b.kategorie_id ? katMap.get(b.kategorie_id) : undefined;
      return {
        id: b.id,
        buchung_datum: b.buchung_datum,
        betrag: Number(b.betrag) || 0,
        konto_id: b.konto_id,
        konto_bezeichnung: kontoMap.get(b.konto_id) ?? "—",
        kategorie_id: b.kategorie_id,
        kategorie_bezeichnung: k?.bezeichnung ?? null,
        kategorie_typ: k?.typ ?? null,
        status: b.status,
      };
    });

    items.push({
      empfaenger: buchungen[0].empfaenger?.trim() || "—",
      intervall: profil.name,
      intervall_tage: Math.round(intervallTage),
      durchschnitt: round2(betragMedian),
      jahresbelastung: round2(betragMedian * profil.proJahr),
      anzahl: buchungen.length,
      erste: buchungen[0].buchung_datum,
      letzte,
      noch_aktiv: nochAktiv,
      konfidenz: round2(konfidenz),
      buchungen: buchungenDetail,
    });
  }

  // Sortierung: aktiv zuerst, dann nach Jahresbelastung absteigend.
  items.sort((a, b) => {
    if (a.noch_aktiv !== b.noch_aktiv) return a.noch_aktiv ? -1 : 1;
    return b.jahresbelastung - a.jahresbelastung;
  });

  const jahresbelastungAktiv = round2(
    items
      .filter((i) => i.noch_aktiv)
      .reduce((s, i) => s + i.jahresbelastung, 0),
  );

  const payload: WiederkehrendResponse = {
    items,
    jahresbelastung_aktiv: jahresbelastungAktiv,
    lookback: { von: lookbackVon, bis },
  };
  return NextResponse.json(payload);
}

function isoHeute(): string {
  return toIso(new Date());
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
