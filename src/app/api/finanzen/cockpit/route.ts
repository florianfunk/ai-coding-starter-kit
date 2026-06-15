// PROJ-14 — Finanz-Cockpit-Aggregation. Liefert in einem Aufruf alles,
// was die Cockpit-Sicht zur Zeit braucht:
//   - Monatsverlauf (Einnahmen / Ausgaben / Saldo)
//   - Top-N Ausgaben-Kategorien (für Donut + Liste)
//   - Top-N Empfänger / Zahlungspartner
//   - Kennzahlen (Einnahmen, Ausgaben, Saldo, Buchungsanzahl)
//
// Filter wie überall: Zeitraum, Konto, Bereich (geschaeft/privat/alle).
// Bereichs-Filter folgt der kanonischen JS-Logik in `istImBereich`.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { analyseFilterSchema } from "@/lib/validation/kategorien-analyse";
import { istImBereich } from "@/lib/finanzen/bereich-filter";
import { ladeAlle } from "@/lib/supabase/fetch-all";
import type { KategorieTyp, Klassifikation } from "@/lib/types";

interface BuchungRow {
  id: string;
  buchung_datum: string;
  betrag: number;
  empfaenger: string | null;
  klassifikation: Klassifikation | null;
  kategorie_id: string | null;
}

export interface MonatsPunkt {
  /** YYYY-MM */
  monat: string;
  einnahmen: number;
  ausgaben: number;
  saldo: number;
}

export interface KategorieAnteil {
  kategorie_id: string | null;
  bezeichnung: string;
  typ: KategorieTyp | "ohne";
  summe: number;
  anzahl: number;
  /** Anteil an der Summe aller Ausgaben (0..1). */
  anteil: number;
}

export interface EmpfaengerAnteil {
  empfaenger: string;
  summe: number;
  anzahl: number;
  /** Durchschnitt pro Buchung. */
  schnitt: number;
  /** Anteil an der Summe aller Ausgaben (0..1). */
  anteil: number;
}

export interface CockpitResponse {
  kennzahlen: {
    einnahmen: number;
    ausgaben: number;
    saldo: number;
    buchungen: number;
  };
  monate: MonatsPunkt[];
  top_kategorien: KategorieAnteil[];
  top_empfaenger: EmpfaengerAnteil[];
}

const TOP_KATEGORIEN_LIMIT = 8;
const TOP_EMPFAENGER_LIMIT = 12;

/** Normalisiert Empfänger-Strings für Gruppierung. */
function normEmpfaenger(s: string | null): string {
  if (!s) return "(kein Empfänger)";
  return s
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[\.,;:]+$/g, "");
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

  const von = filter.von ?? (filter.jahr ? `${filter.jahr}-01-01` : null);
  const bis = filter.bis ?? (filter.jahr ? `${filter.jahr}-12-31` : null);

  // Vollständig paginiert laden — PostgREST deckelt sonst bei 1000 Zeilen und
  // schnitte (asc-Sortierung) neuere Buchungen ab. Stabile Sortierung via id.
  const { data: bData, error: bErr } = await ladeAlle((vonIdx, bisIdx) => {
    let q = supabase
      .from("buchung")
      .select(
        "id, buchung_datum, betrag, empfaenger, klassifikation, kategorie_id",
      )
      .eq("owner_id", user.id)
      .order("buchung_datum", { ascending: true })
      .order("id", { ascending: true })
      .range(vonIdx, bisIdx);
    if (von) q = q.gte("buchung_datum", von);
    if (bis) q = q.lte("buchung_datum", bis);
    if (filter.konto_id) q = q.eq("konto_id", filter.konto_id);
    if (filter.nur_steuerrelevant) q = q.eq("steuerrelevant", true);
    return q;
  });
  if (bErr) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  // Kategorien laden — wir brauchen den Typ für die Bereichs-Logik UND die
  // Bezeichnung für die Top-Kategorien-Liste.
  const { data: kData, error: kErr } = await supabase
    .from("kategorie")
    .select("id, bezeichnung, typ")
    .eq("owner_id", user.id)
    .limit(1000);
  if (kErr) {
    return NextResponse.json(
      { error: "Kategorien konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const katMap = new Map(
    ((kData ?? []) as Array<{ id: string; bezeichnung: string; typ: KategorieTyp }>).map(
      (k) => [k.id, k],
    ),
  );

  const buchungen = ((bData ?? []) as BuchungRow[]).filter((b) =>
    istImBereich(
      {
        klassifikation: b.klassifikation,
        kategorieTyp: b.kategorie_id ? (katMap.get(b.kategorie_id)?.typ ?? null) : null,
      },
      filter.bereich,
    ),
  );

  // Klassifikation einer Buchung als Einnahme/Ausgabe — zwei Quellen:
  //   1) Kategorie-Typ (verlässlich), 2) Vorzeichen des Betrags (Fallback
  //   bei unkategorisiert oder Bereich 'privat' ohne Kategorie).
  type Richtung = "einnahme" | "ausgabe" | "neutral";
  function richtung(b: BuchungRow): Richtung {
    const typ = b.kategorie_id ? katMap.get(b.kategorie_id)?.typ : null;
    if (typ === "einnahme") return "einnahme";
    if (typ === "ausgabe") return "ausgabe";
    if (typ === "neutral") return "neutral";
    // Fallback: Vorzeichen
    const betrag = Number(b.betrag) || 0;
    if (betrag > 0) return "einnahme";
    if (betrag < 0) return "ausgabe";
    return "neutral";
  }

  // ------------------------------------------------------------------
  // Monatsverlauf
  // ------------------------------------------------------------------
  const monatsMap = new Map<string, MonatsPunkt>();
  for (const b of buchungen) {
    const m = b.buchung_datum.slice(0, 7); // YYYY-MM
    const punkt =
      monatsMap.get(m) ??
      ({ monat: m, einnahmen: 0, ausgaben: 0, saldo: 0 } satisfies MonatsPunkt);
    const r = richtung(b);
    const betrag = Number(b.betrag) || 0;
    if (r === "einnahme") punkt.einnahmen += Math.abs(betrag);
    else if (r === "ausgabe") punkt.ausgaben += Math.abs(betrag);
    punkt.saldo = punkt.einnahmen - punkt.ausgaben;
    monatsMap.set(m, punkt);
  }
  const monate = Array.from(monatsMap.values())
    .map((p) => ({
      monat: p.monat,
      einnahmen: round2(p.einnahmen),
      ausgaben: round2(p.ausgaben),
      saldo: round2(p.einnahmen - p.ausgaben),
    }))
    .sort((a, b) => a.monat.localeCompare(b.monat));

  // ------------------------------------------------------------------
  // Top-Kategorien (Ausgaben) — Donut + Liste
  // ------------------------------------------------------------------
  const katAcc = new Map<
    string,
    { kategorie_id: string | null; bezeichnung: string; typ: KategorieTyp | "ohne"; summe: number; anzahl: number }
  >();
  for (const b of buchungen) {
    if (richtung(b) !== "ausgabe") continue;
    const k = b.kategorie_id ? katMap.get(b.kategorie_id) : null;
    const key = b.kategorie_id ?? "__ohne__";
    const eintrag =
      katAcc.get(key) ??
      {
        kategorie_id: b.kategorie_id ?? null,
        bezeichnung: k?.bezeichnung ?? "— ohne Kategorie —",
        typ: (k?.typ as KategorieTyp | undefined) ?? "ohne",
        summe: 0,
        anzahl: 0,
      };
    eintrag.summe += Math.abs(Number(b.betrag) || 0);
    eintrag.anzahl++;
    katAcc.set(key, eintrag);
  }
  const ausgabenSummeKat = Array.from(katAcc.values()).reduce(
    (s, k) => s + k.summe,
    0,
  );
  const topKategorien: KategorieAnteil[] = Array.from(katAcc.values())
    .sort((a, b) => b.summe - a.summe)
    .slice(0, TOP_KATEGORIEN_LIMIT)
    .map((k) => ({
      kategorie_id: k.kategorie_id,
      bezeichnung: k.bezeichnung,
      typ: k.typ,
      summe: round2(k.summe),
      anzahl: k.anzahl,
      anteil: ausgabenSummeKat > 0 ? k.summe / ausgabenSummeKat : 0,
    }));

  // ------------------------------------------------------------------
  // Top-Empfänger (Ausgaben)
  // ------------------------------------------------------------------
  const empfAcc = new Map<string, { empfaenger: string; summe: number; anzahl: number }>();
  for (const b of buchungen) {
    if (richtung(b) !== "ausgabe") continue;
    const key = normEmpfaenger(b.empfaenger);
    const eintrag = empfAcc.get(key) ?? {
      empfaenger: b.empfaenger?.trim() || "(kein Empfänger)",
      summe: 0,
      anzahl: 0,
    };
    eintrag.summe += Math.abs(Number(b.betrag) || 0);
    eintrag.anzahl++;
    empfAcc.set(key, eintrag);
  }
  const ausgabenSummeEmpf = Array.from(empfAcc.values()).reduce(
    (s, e) => s + e.summe,
    0,
  );
  const topEmpfaenger: EmpfaengerAnteil[] = Array.from(empfAcc.values())
    .sort((a, b) => b.summe - a.summe)
    .slice(0, TOP_EMPFAENGER_LIMIT)
    .map((e) => ({
      empfaenger: e.empfaenger,
      summe: round2(e.summe),
      anzahl: e.anzahl,
      schnitt: round2(e.summe / e.anzahl),
      anteil: ausgabenSummeEmpf > 0 ? e.summe / ausgabenSummeEmpf : 0,
    }));

  // ------------------------------------------------------------------
  // Kennzahlen (Gesamtsummen)
  // ------------------------------------------------------------------
  let einnahmen = 0;
  let ausgaben = 0;
  for (const b of buchungen) {
    const betrag = Math.abs(Number(b.betrag) || 0);
    const r = richtung(b);
    if (r === "einnahme") einnahmen += betrag;
    else if (r === "ausgabe") ausgaben += betrag;
  }

  const payload: CockpitResponse = {
    kennzahlen: {
      einnahmen: round2(einnahmen),
      ausgaben: round2(ausgaben),
      saldo: round2(einnahmen - ausgaben),
      buchungen: buchungen.length,
    },
    monate,
    top_kategorien: topKategorien,
    top_empfaenger: topEmpfaenger,
  };
  return NextResponse.json(payload);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
