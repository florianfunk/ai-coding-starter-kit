// PROJ-14 — Abo-/Wiederkehr-Radar. Heuristische Erkennung von
// regelmäßigen Zahlungen aus den Buchungsdaten — ohne Schema-Änderung,
// rein über Muster.
//
// Algorithmus (knapp):
//   1) Lade Buchungen (Einnahmen UND Ausgaben) im erweiterten Zeitraum.
//   2) Gruppiere nach `empfaenger_normalisiert` (PROJ-15-Spalte), Fallback auf
//      `normalisiereEmpfaenger(empfaenger)` für eventuelle Altdaten.
//   3) Für jede Gruppe mit ≥ MIN_BUCHUNGEN:
//      - Cluster-Erkennung über src/lib/finanzen/wiederkehrend-erkennung.ts
//      - Toleriert einzelne Ausreißer-Buchungen (siehe dortige Doku).
//      - Aktivität: letzte Zahlung darf nicht älter als 1.5× Intervall sein
//   4) Berechne erwartetes Jahresvolumen, getrennt nach Einnahmen/Ausgaben.
//
// Filter: Zeitraum, Konto, Bereich. Filter wird *vorsichtig* angewendet —
// wir erweitern den Zeitraum nach vorne, um auch Abos mit nur wenigen
// Buchungen im Filterzeitraum zu erkennen (mind. 365 Tage Lookback).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { analyseFilterSchema } from "@/lib/validation/kategorien-analyse";
import { istImBereich } from "@/lib/finanzen/bereich-filter";
import { normalisiereEmpfaenger } from "@/lib/classifier/normalize";
import {
  erkenneCluster,
  modusEmpfaenger,
  MIN_BUCHUNGEN,
  MIN_LOOKBACK_TAGE,
  tageZwischen,
  klassifiziereIntervall,
  type Intervall,
  type Richtung,
} from "@/lib/finanzen/wiederkehrend-erkennung";
import type { BuchungStatus, KategorieTyp, Klassifikation } from "@/lib/types";

interface BuchungRow {
  id: string;
  konto_id: string;
  buchung_datum: string;
  betrag: number;
  empfaenger: string | null;
  empfaenger_normalisiert: string | null;
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
  /** Bug-3-Fix: Wenn true, weicht der Betrag stark vom Cluster-Median ab. */
  ausreisser?: boolean;
}

export type { Intervall, Richtung };

export interface WiederkehrendItem {
  empfaenger: string;
  intervall: Intervall;
  /** Median-Abstand in Tagen — vor allem für Debug-Sicht. */
  intervall_tage: number;
  /** Mittlerer Buchungs-Betrag (Absolutwert). */
  durchschnitt: number;
  /** Geschätztes Jahresvolumen (positiv = Einnahme, identisch bei Ausgabe als Absolutwert). */
  jahresbelastung: number;
  /** Richtung: 'einnahme' wenn Mehrheit positive Beträge, sonst 'ausgabe'. */
  richtung: Richtung;
  /** Anzahl gefundener Buchungen im erweiterten Lookback (inkl. Ausreißer). */
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
  /** Summe aller geschätzten Jahresvolumina der aktiven Ausgaben-Items. */
  jahresbelastung_ausgaben_aktiv: number;
  /** Summe aller geschätzten Jahresvolumina der aktiven Einnahmen-Items. */
  jahresbelastung_einnahmen_aktiv: number;
  /**
   * @deprecated — bleibt aus Kompat-Gründen erhalten, entspricht
   * `jahresbelastung_ausgaben_aktiv`. UI soll die getrennten Felder nutzen.
   */
  jahresbelastung_aktiv: number;
  /** Lookback-Fenster, das tatsächlich abgefragt wurde (Debug). */
  lookback: { von: string; bis: string };
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
      "id, konto_id, buchung_datum, betrag, empfaenger, empfaenger_normalisiert, klassifikation, kategorie_id, status",
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

  // Bereichs-Filter — Einnahmen werden NICHT mehr generell rausgeworfen
  // (Bug 1). Plus-Beträge ohne Kategorie sind potenzielle Einnahmen-Abos
  // (z. B. Gehalt vor Klassifizierung) und bleiben daher drin.
  const buchungenGefiltert = ((bData ?? []) as BuchungRow[]).filter((b) => {
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
    return Number(b.betrag) !== 0;
  });

  // Gruppierung nach `empfaenger_normalisiert`. Bei NULL/leer als Fallback
  // einmal `normalisiereEmpfaenger(empfaenger)` aufrufen (Altdaten ohne
  // Backfill — sollte nach PROJ-15 nicht mehr auftauchen, aber wir lassen
  // das Sicherheitsnetz drin).
  const gruppen = new Map<string, BuchungRow[]>();
  for (const b of buchungenGefiltert) {
    const normaus = (b.empfaenger_normalisiert ?? "").trim();
    const key = normaus || normalisiereEmpfaenger(b.empfaenger);
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

    const cluster = erkenneCluster(buchungen);
    if (!cluster) continue;

    // Aktivität: letzte Zahlung < 1.5× Intervall her?
    const letzte = buchungen[buchungen.length - 1].buchung_datum;
    const profil = klassifiziereIntervall(cluster.intervall_tage);
    if (!profil) continue;
    const tageSeitLetzter = tageZwischen(letzte, toIso(heute));
    const nochAktiv = tageSeitLetzter <= profil.max * 1.5;

    const buchungenDetail: WiederkehrendBuchung[] = cluster.buchungen.map(
      (b) => {
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
          ausreisser: b.ausreisser || undefined,
        };
      },
    );

    // Anzeige-Empfänger: häufigste Original-Variante im Cluster (Mode).
    const anzeigeEmpfaenger =
      modusEmpfaenger(buchungen.map((b) => b.empfaenger)) || "—";

    items.push({
      empfaenger: anzeigeEmpfaenger,
      intervall: cluster.intervall,
      intervall_tage: cluster.intervall_tage,
      durchschnitt: round2(cluster.betrag_median),
      jahresbelastung: round2(cluster.jahresvolumen),
      richtung: cluster.richtung,
      anzahl: cluster.anzahl,
      erste: buchungen[0].buchung_datum,
      letzte,
      noch_aktiv: nochAktiv,
      konfidenz: round2(cluster.konfidenz),
      buchungen: buchungenDetail,
    });
  }

  // Sortierung: aktiv zuerst, dann nach Jahresvolumen absteigend.
  items.sort((a, b) => {
    if (a.noch_aktiv !== b.noch_aktiv) return a.noch_aktiv ? -1 : 1;
    return b.jahresbelastung - a.jahresbelastung;
  });

  const jahresbelastungAusgabenAktiv = round2(
    items
      .filter((i) => i.noch_aktiv && i.richtung === "ausgabe")
      .reduce((s, i) => s + i.jahresbelastung, 0),
  );
  const jahresbelastungEinnahmenAktiv = round2(
    items
      .filter((i) => i.noch_aktiv && i.richtung === "einnahme")
      .reduce((s, i) => s + i.jahresbelastung, 0),
  );

  const payload: WiederkehrendResponse = {
    items,
    jahresbelastung_ausgaben_aktiv: jahresbelastungAusgabenAktiv,
    jahresbelastung_einnahmen_aktiv: jahresbelastungEinnahmenAktiv,
    jahresbelastung_aktiv: jahresbelastungAusgabenAktiv, // Backwards-Compat
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
