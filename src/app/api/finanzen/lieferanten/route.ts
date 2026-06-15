// PROJ-18 — Lieferanten-API. Liefert wiederkehrende Empfänger OHNE
// Abo-Muster (Aldi, MediaMarkt, …). Spiegelt die Filter-/Lookback-
// Logik von /api/finanzen/wiederkehrend, damit Filter konsistent
// wirken. Die eigentliche Aggregation lebt in
// src/lib/finanzen/lieferanten-erkennung.ts (testbar ohne DB).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { analyseFilterSchema } from "@/lib/validation/kategorien-analyse";
import { istImBereich } from "@/lib/finanzen/bereich-filter";
import {
  erkenneLieferanten,
  type LieferantItem,
  type LieferantenBuchung,
} from "@/lib/finanzen/lieferanten-erkennung";
import { MIN_LOOKBACK_TAGE } from "@/lib/finanzen/wiederkehrend-erkennung";
import type { BuchungStatus, KategorieTyp, Klassifikation } from "@/lib/types";

/** Drill-Down-Repräsentation einer Buchung im Lieferanten-Tab. */
export interface LieferantBuchungAnzeige {
  id: string;
  buchung_datum: string;
  betrag: number;
  konto_id: string;
  konto_bezeichnung: string;
  kategorie_id: string | null;
  kategorie_bezeichnung: string | null;
  kategorie_typ: KategorieTyp | null;
  klassifikation: Klassifikation | null;
  status: BuchungStatus;
}

export interface LieferantItemAnzeige
  extends Omit<LieferantItem, "buchungen"> {
  /** Optionale Auflösung der dominanten Kategorie für die UI. */
  dominante_kategorie_anzeige: {
    id: string;
    bezeichnung: string;
    typ: KategorieTyp;
    anzahl: number;
    anteil: number;
  } | null;
  buchungen: LieferantBuchungAnzeige[];
}

export interface LieferantenResponse {
  items: LieferantItemAnzeige[];
  lookback: { von: string; bis: string };
}

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

  // Lookback wie im Abo-Radar: min. 365 Tage. So sehen wir auch saisonale
  // Lieferanten, selbst wenn der Filter nur einen Monat umfasst.
  const bis =
    filter.bis ?? (filter.jahr ? `${filter.jahr}-12-31` : isoHeute());
  const filterVon =
    filter.von ?? (filter.jahr ? `${filter.jahr}-01-01` : null);
  const lookbackStart = new Date(bis);
  lookbackStart.setDate(lookbackStart.getDate() - MIN_LOOKBACK_TAGE);
  const lookbackVon =
    filterVon && filterVon < toIso(lookbackStart)
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

  // Stammdaten parallel.
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

  // Bereichs- und nur_steuerrelevant-Filter — identisch zur Wiederkehr-API.
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
    if (filter.nur_steuerrelevant) {
      const typ = katInfo?.typ ?? null;
      if (typ !== "einnahme" && typ !== "ausgabe") return false;
    }
    return Number(b.betrag) !== 0;
  });

  const eingang: LieferantenBuchung[] = buchungenGefiltert.map((b) => ({
    id: b.id,
    empfaenger: b.empfaenger,
    empfaenger_normalisiert: b.empfaenger_normalisiert,
    buchung_datum: b.buchung_datum,
    betrag: Number(b.betrag) || 0,
    klassifikation: b.klassifikation,
    kategorie_id: b.kategorie_id,
    kategorie_typ: b.kategorie_id
      ? (katMap.get(b.kategorie_id)?.typ ?? null)
      : null,
    konto_id: b.konto_id,
    status: b.status,
  }));

  const items = erkenneLieferanten(eingang);

  const anzeige: LieferantItemAnzeige[] = items.map((it) => {
    const domKat = it.dominante_kategorie
      ? (() => {
          const info = katMap.get(it.dominante_kategorie.id);
          if (!info) return null;
          return {
            id: it.dominante_kategorie.id,
            bezeichnung: info.bezeichnung,
            typ: info.typ,
            anzahl: it.dominante_kategorie.anzahl,
            anteil: it.dominante_kategorie.anteil,
          };
        })()
      : null;
    return {
      ...it,
      dominante_kategorie_anzeige: domKat,
      buchungen: it.buchungen.map((b) => {
        const k = b.kategorie_id ? katMap.get(b.kategorie_id) : undefined;
        return {
          id: b.id,
          buchung_datum: b.buchung_datum,
          betrag: b.betrag,
          konto_id: b.konto_id,
          konto_bezeichnung: kontoMap.get(b.konto_id) ?? "—",
          kategorie_id: b.kategorie_id,
          kategorie_bezeichnung: k?.bezeichnung ?? null,
          kategorie_typ: k?.typ ?? null,
          klassifikation: b.klassifikation,
          status: b.status,
        };
      }),
    };
  });

  const payload: LieferantenResponse = {
    items: anzeige,
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
